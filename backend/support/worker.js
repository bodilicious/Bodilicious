import { Worker } from "bullmq";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Ticket } from "./models.js";
import Order from "../tracker/models.js";
import Razorpay from "razorpay";

dotenv.config();

const connection = {
  url: process.env.REDIS_URL,
};

const appendSystemNote = async (ticket, text, visibleToCustomer) => {
  ticket.messages.push({
    text,
    authorRole: "system",
    isAutomated: true,
    visibleToCustomer,
    authorId: null,
  });
  await ticket.save();
};

export const processLookup = async (job) => {
  const { ticketId, type, orderId } = job.data;
  
  if (!orderId) {
    return;
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  // Idempotency check: has the system already replied?
  const hasSystemReply = ticket.messages.some(m => m.authorRole === "system");
  if (hasSystemReply) {
    console.log(`[Support Worker] Ticket ${ticketId} already has a system note. Skipping.`);
    return;
  }

  try {
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    } else {
      // Handle custom user-entered order formats (e.g., #34791459, ORD-34791459)
      const cleanId = orderId.replace(/^#|^ORD-/i, "").trim().toLowerCase();
      const userOrders = await Order.find({ user: ticket.userId });
      order = userOrders.find(o => o._id.toString().toLowerCase().endsWith(cleanId));
    }

    if (!order) {
      await appendSystemNote(ticket, "Auto-lookup failed: Order not found.", false);
      return;
    }

    // Security check: verify order belongs to the user who opened the ticket
    if (order.user.toString() !== ticket.userId.toString()) {
      await appendSystemNote(ticket, "Auto-lookup blocked: Order does not belong to ticket creator.", false);
      return;
    }

    if (type === "shipping") {
      let note = `Order Status: ${order.orderStatus.replace(/_/g, ' ').toUpperCase()}`;
      if (order.shipmentId) {
        note += `\nShiprocket Shipment ID: ${order.shipmentId}`;
      }
      if (order.estimatedDeliveryDate) {
        note += `\nEstimated Delivery: ${new Date(order.estimatedDeliveryDate).toLocaleDateString()}`;
      }
      await appendSystemNote(ticket, note, true);

    } else if (type === "payment") {
      if (order.razorpayPaymentId) {
        try {
          const razorpayInstance = new Razorpay({
              key_id: process.env.RAZORPAY_KEY_ID,
              key_secret: process.env.RAZORPAY_KEY_SECRET,
          });
          const rp = await razorpayInstance.payments.fetch(order.razorpayPaymentId);
          let note = `Payment Status: ${rp.status.toUpperCase()}`;
          note += `\nAmount: ₹${rp.amount / 100}`;
          if (rp.method) note += `\nMethod: ${rp.method.toUpperCase()}`;
          await appendSystemNote(ticket, note, true);
        } catch (rpErr) {
          await appendSystemNote(ticket, `Auto-lookup failed: Razorpay fetch error: ${rpErr.message}`, false);
        }
      } else {
         await appendSystemNote(ticket, `Order Payment Status: ${order.paymentStatus}`, true);
      }
    }
  } catch (err) {
    console.error(`[Support Worker] Error processing ticket ${ticketId}:`, err);
    await appendSystemNote(ticket, `Auto-lookup failed: Internal error - ${err.message}`, false).catch(console.error);
    throw err; // Allow BullMQ to retry if it's a transient error
  }
};

let workerInstance = null;

export const startSupportWorker = () => {
  if (workerInstance) return workerInstance;

  if (!process.env.REDIS_URL) {
    console.warn("[Support Worker] REDIS_URL not set. Worker not started.");
    return null;
  }

  workerInstance = new Worker("support_jobs", processLookup, {
    connection,
    concurrency: 5,
    drainDelay: 300000,
    stalledInterval: 300000,
    metrics: { maxDataPoints: 0 }
  });

  workerInstance.on("completed", (job) => {
    console.log(`[Support Worker] Job ${job.id} completed`);
  });

  workerInstance.on("failed", (job, err) => {
    console.error(`[Support Worker] Job ${job.id} failed:`, err.message);
  });

  console.log("[Support Worker] Started listening on 'support_jobs' queue");
  return workerInstance;
};
