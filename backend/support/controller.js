import { Ticket, FAQ } from "./models.js";
import Order from "../tracker/models.js";
import mongoose from "mongoose";
import { enqueueTicketLookup } from "./queue.js";
import {
  sendTicketAcknowledgementEmail,
  sendTicketReplyEmail,
  sendTicketResolvedEmail,
  sendTicketCancelledEmail,
} from "../email/emailService.js";
import { v2 as cloudinary } from "cloudinary";
import { enqueueWhatsApp } from "../whatsapp/queue.js";
import { sign as signInternal, safeEqual } from "../utils/signing.js";
import { getSettings } from "../settings/cache.js";
import _redis from "../utils/redis.js";
import NotificationService from "../procurement/notificationService.js";

// Use the shared singleton; fall back to a no-op if Redis is unavailable.
// incr returns a Promise since the call site uses await.
const redis = _redis ?? { incr: () => Promise.resolve(0) };

/**
 * Support attachments are uploaded before the ticket/message exists (the UI lets
 * you attach, then remove, then send), so there is no ticket to check ownership
 * against on delete. Instead we stamp a non-reversible owner tag into the
 * Cloudinary public_id at upload time and verify it on delete.
 *
 * An HMAC is used rather than the raw ObjectId so the uploader's user id is not
 * exposed in an attachment URL that other parties may see.
 */
const ownerTagFor = (userId) => signInternal(`support-upload:${userId}`).slice(0, 16);
const OWNER_TAG_RE = /(?:^|\/)BD-SUP-o([0-9a-f]{16})-/;

// POST /api/v1/support/tickets
export const createTicket = async (req, res) => {
  try {
    const { type, description, attachments, orderId } = req.body;

    if (!type || !description) {
      return res.status(400).json({ success: false, message: "Type and description are required" });
    }

    const priority = type === "payment" ? "high" : "normal";

    // Seed the conversation thread with the customer's initial description
    const ticket = await Ticket.create({
      userId: req.user._id,
      type,
      description,
      priority,
      messages: [
        {
          text: description,
          authorId: req.user._id,
          authorRole: "customer",
          attachments: attachments || [],
        },
      ],
      orderId: orderId || undefined,
    });

    await ticket.save();

    // Populate user for email
    await ticket.populate("userId", "name email");

    // Send acknowledgement email (blocking)
    if (ticket.userId?.email) {
      await sendTicketAcknowledgementEmail(
        ticket,
        ticket.userId.email,
        ticket.userId.name || "Customer"
      ).catch((err) => console.error("Ticket ack email failed:", err.message));
    }

    // Enqueue WhatsApp Notification
    const settings = await getSettings();
    if (settings.waAllEnabled && settings.waTicketRaisedEnabled) {
      await enqueueWhatsApp("ticket_raised", { ticketId: ticket._id.toString() }).catch(err => console.error("Failed to enqueue WhatsApp ticket_raised:", err));
    }

    await NotificationService.emit({
      title: "New Support Ticket",
      body: `Ticket #${ticket._id.toString().slice(-6).toUpperCase()} created for ${type}.`,
      type: "info",
      sourceModule: "support",
      sourceModel: "Ticket",
      sourceId: ticket._id.toString(),
    });

    if (orderId && (type === "shipping" || type === "payment")) {
      await enqueueTicketLookup(ticket._id.toString(), type, orderId);
    }

    return res.status(201).json({ success: true, ticket });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/support/tickets/:userId/unread-count
// Lightweight alternative to fetching all tickets just to count unread ones.
// Returns { count: N } — ~100 bytes vs the full ticket payload with all messages.
export const getUserTicketUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const isOwner = req.user._id.toString() === userId || req.user.firebaseUID === userId;
    const isAdmin = req.user.role === "admin" || req.user.role === "primary_admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let queryUserId = userId;
    if (userId === req.user.firebaseUID) {
      queryUserId = req.user._id;
    }

    // Count open tickets where the last message was sent by an admin or system
    // (meaning the customer has an unread admin reply waiting)
    const result = await Ticket.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(queryUserId)), status: "open" } },
      {
        $addFields: {
          lastMessage: { $arrayElemAt: ["$messages", -1] }
        }
      },
      {
        $match: {
          "lastMessage.authorRole": { $in: ["admin", "system"] },
          $or: [
            { "lastMessage.visibleToCustomer": { $ne: false } },
            { "lastMessage.visibleToCustomer": { $exists: false } }
          ]
        }
      },
      { $count: "count" }
    ]);

    const count = result[0]?.count ?? 0;
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error("Error fetching ticket unread count:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/support/tickets/:userId  (customer or admin fetching by userId)
export const getUserTickets = async (req, res) => {
  try {
    const { userId } = req.params;

    const isOwner = req.user._id.toString() === userId || req.user.firebaseUID === userId;
    const isAdmin = req.user.role === "admin" || req.user.role === "primary_admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let queryUserId = userId;
    if (userId === req.user.firebaseUID) {
      queryUserId = req.user._id;
    }

    const tickets = await Ticket.find({ userId: queryUserId }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/support/tickets  (admin — all tickets)
export const getAllTickets = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin" || req.user.role === "primary_admin";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { status, type } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    // "open" < "resolved" and "high" < "normal" alphabetically — correct sort order
    const tickets = await Ticket.find(query)
      .populate("userId", "name email photoURL")
      .sort({ status: 1, priority: 1, createdAt: -1 });

    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error("Error fetching all tickets:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/support/tickets/:id/messages
export const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, attachments } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }

    const ticket = await Ticket.findById(id).populate("userId", "name email");
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const isOwner = req.user._id.toString() === ticket.userId._id.toString();
    const isAdmin = req.user.role === "admin" || req.user.role === "primary_admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Block messages on closed threads
    if (ticket.status === "resolved") {
      return res.status(403).json({ success: false, message: "Cannot add messages to a resolved ticket" });
    }

    const authorRole = isAdmin ? "admin" : "customer";

    ticket.messages.push({
      text: text.trim(),
      authorId: req.user._id,
      authorRole,
      attachments: attachments || [],
    });

    await ticket.save();

    // Re-populate so the response has full userId data
    await ticket.populate("userId", "name email photoURL");

    // If admin replied, notify the customer by email (blocking)
    if (authorRole === "admin" && ticket.userId?.email) {
      await sendTicketReplyEmail(
        ticket,
        text.trim(),
        ticket.userId.email,
        ticket.userId.name || "Customer"
      ).catch((err) => console.error("Ticket reply email failed:", err.message));
    }

    // If customer replied, notify admin
    if (authorRole === "customer") {
      await NotificationService.emit({
        title: "Ticket Reply",
        body: `Customer replied to ticket #${ticket._id.toString().slice(-6).toUpperCase()}.`,
        type: "info",
        sourceModule: "support",
        sourceModel: "Ticket",
        sourceId: ticket._id.toString(),
      });
    }

    return res.status(201).json({ success: true, ticket });
  } catch (error) {
    console.error("Error adding message:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /api/v1/support/tickets/:id  (update status)
export const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, message } = req.body;

    if (!status || !["open", "resolved", "cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const ticket = await Ticket.findById(id).populate("userId", "name email");
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const isOwner = req.user._id.toString() === ticket.userId._id.toString();
    const isAdmin = req.user.role === "admin" || req.user.role === "primary_admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const wasOpen = ticket.status === "open";

    ticket.status = status;

    if (status === "resolved") {
      ticket.resolvedAt = new Date();
    } else {
      ticket.resolvedAt = null;
    }

    await ticket.save();

    // Fire resolution email only on first resolve
    if (status === "resolved" && wasOpen && ticket.userId?.email) {
      await sendTicketResolvedEmail(ticket, ticket.userId.email, ticket.userId.name || "Customer", message).catch((err) => {
        console.error("Failed to send ticket resolved email:", id, err.message);
      });
    }

    // Fire WhatsApp notification if status changed to resolved
    if (status === "resolved" && wasOpen) {
      const settings = await getSettings();
      if (settings.waAllEnabled && settings.waTicketResolvedEnabled) {
        await enqueueWhatsApp("ticket_resolved", { ticketId: ticket._id.toString() }).catch(err => console.error("Failed to enqueue WhatsApp ticket_resolved:", err));
      }
    }

    // Fire cancelled email
    if (status === "cancelled" && wasOpen && ticket.userId?.email) {
      await sendTicketCancelledEmail(ticket, ticket.userId.email, ticket.userId.name || "Customer", message).catch((err) => {
        console.error("Failed to send ticket cancelled email:", id, err.message);
      });
    }

    // Invalidate users cache since tickets affect user stats/flags
    await redis.incr("admin:users:version");

    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/support/tickets/:id/order (admin - fetch brief order info for ticket)
export const getTicketOrder = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin" || req.user.role === "primary_admin";
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || !ticket.orderId) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    let order = null;
    if (mongoose.Types.ObjectId.isValid(ticket.orderId)) {
      order = await Order.findById(ticket.orderId);
    } else {
      const cleanId = ticket.orderId.replace(/^#|^ORD-/i, "").trim().toLowerCase();
      const userOrders = await Order.find({ user: ticket.userId });
      order = userOrders.find(o => o._id.toString().toLowerCase().endsWith(cleanId));
    }

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderInfo = {
      _id: order._id,
      shortId: order._id.toString().slice(-8).toUpperCase(),
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      createdAt: order.createdAt,
      itemsCount: order.items?.length || 0,
      awb: order.awb || null,
    };

    return res.status(200).json({ success: true, order: orderInfo });
  } catch (error) {
    console.error("Error fetching ticket order:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/support/faqs
export const getFaqs = async (req, res) => {
  try {
    const faqs = await FAQ.find().sort({ order: 1, createdAt: -1 });
    return res.status(200).json({ success: true, faqs });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/support/upload
export const uploadSupportAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ success: false, message: "Cloudinary keys missing from .env" });
    }

    // Configure Cloudinary inline
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET 
    });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    // The `o<tag>` segment binds this upload to the uploader so deleteSupportAttachment
    // can prove ownership without a ticket lookup.
    const filename = `BD-SUP-o${ownerTagFor(req.user._id)}-${uniqueSuffix}-${safeOriginalName}`;

    // Wrap upload_stream in a Promise
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          folder: "bodilicious_support",
          public_id: filename
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(new Error("Failed to upload to Cloudinary"));
          } else {
            resolve(result);
          }
        }
      );
      stream.end(req.file.buffer);
    });

    return res.status(200).json({
      success: true,
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url
    });

  } catch (err) {
    console.error("Support UploadAttachment Error:", err.message || err);
    return res.status(500).json({ success: false, message: err.message || "Failed to upload image" });
  }
};

// DELETE /api/v1/support/upload
export const deleteSupportAttachment = async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ success: false, message: "Public ID is required" });
    }

    // Security check: Only allow deleting files in the bodilicious_support folder
    if (!publicId.startsWith("bodilicious_support/")) {
      return res.status(400).json({ success: false, message: "Access denied: Invalid folder" });
    }

    // Ownership check. Without this, any authenticated user could permanently
    // delete another customer's support attachment just by knowing its publicId.
    const isAdmin = req.user.role === "admin" || req.user.role === "primary_admin";
    if (!isAdmin) {
      const match = OWNER_TAG_RE.exec(publicId);
      // Untagged files predate owner stamping; only admins may remove those.
      if (!match || !safeEqual(match[1], ownerTagFor(req.user._id))) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ success: false, message: "Cloudinary keys missing from .env" });
    }

    // Configure Cloudinary inline
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET 
    });

    const destroyResult = await cloudinary.uploader.destroy(publicId);

    if (destroyResult.result !== "ok" && destroyResult.result !== "not found") {
      return res.status(500).json({ success: false, message: "Failed to delete from Cloudinary" });
    }

    return res.status(200).json({ success: true, message: "Attachment deleted" });
  } catch (error) {
    console.error("Support DeleteAttachment Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
