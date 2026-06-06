import { Worker } from "bullmq";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import { getPhone } from "./service.js";
import {
  sendOrderPlaced,
  sendStaleCart,
  sendOutForDelivery,
  sendTicketRaised,
  sendTicketResolved,
  sendTrendingProduct,
  sendReEngagement,
  sendPaymentFailure,
} from "./templates.js";
import UserProfile from "../profile/models.js";
import Order from "../tracker/models.js";
import { Ticket } from "../support/models.js";
import Product from "../products/models.js";
import { getSettings } from "../settings/cache.js";

dotenv.config();

const connection = {
  url: process.env.REDIS_URL,
};

const processJob = async (job) => {
  const { name, data } = job;
  console.log(`[WhatsApp Worker] Processing job ${job.id} of type ${name}`);

  const settings = await getSettings();
  if (!settings.waAllEnabled) {
    console.log(`[WhatsAppWorker] Job ${name} dropped. waAllEnabled is FALSE.`);
    return;
  }

  try {
    switch (name) {
      case "order_placed": {
        if (!settings.waOrderPlacedEnabled) {
          console.log("[WhatsAppWorker] Dropped. waOrderPlacedEnabled is FALSE.");
          return;
        }
        const user = await UserProfile.findById(data.userId);
        const order = await Order.findById(data.orderId);
        if (!user || !order) throw new Error("User or Order not found");

        const phone = getPhone(user, order.shippingDetails?.phone);
        if (!phone) return;

        await sendOrderPlaced(phone, {
          name: user.name || order.shippingDetails?.name,
          order_id: order._id.toString(),
          amount: `₹${order.totalAmount}`,
          edd: order.estimatedDeliveryDate 
            ? new Date(order.estimatedDeliveryDate).toLocaleDateString() 
            : `${order.estimatedDeliveryDays || 3}-5 business days`,
        });
        break;
      }

      case "stale_cart": {
        if (!settings.waStaleCartEnabled) {
          console.log("[WhatsAppWorker] Dropped. waStaleCartEnabled is FALSE.");
          return;
        }
        const user = await UserProfile.findById(data.userId).populate("cart.product");
        if (!user) throw new Error("User not found");

        const phone = getPhone(user);
        if (!phone) return;

        const firstProductName = user.cart?.[0]?.product?.name || "your items";

        await sendStaleCart(phone, {
          name: user.name,
          product_name: firstProductName,
        });
        break;
      }

      case "out_for_delivery": {
        if (!settings.waOutForDeliveryEnabled) {
          console.log("[WhatsAppWorker] Dropped. waOutForDeliveryEnabled is FALSE.");
          return;
        }
        const order = await Order.findById(data.orderId);
        if (!order) throw new Error("Order not found");

        const user = await UserProfile.findById(order.user);
        const phone = getPhone(user, order.shippingDetails?.phone);
        if (!phone) return;

        await sendOutForDelivery(phone, {
          name: order.shippingDetails?.name || user?.name,
          order_id: order._id.toString(),
          courier: order.estimatedCourierName || "Delivery Partner",
          awb: data.awb || order.awb,
        });
        break;
      }

      case "ticket_raised": {
        if (!settings.waTicketRaisedEnabled) {
          console.log("[WhatsAppWorker] Dropped. waTicketRaisedEnabled is FALSE.");
          return;
        }
        const ticket = await Ticket.findById(data.ticketId).populate("userId");
        if (!ticket) throw new Error("Ticket not found");

        const phone = getPhone(ticket.userId);
        if (!phone) return;

        await sendTicketRaised(phone, {
          name: ticket.userId.name,
          ticket_id: ticket._id.toString(),
          type: ticket.type,
        });
        break;
      }

      case "ticket_resolved": {
        if (!settings.waTicketResolvedEnabled) {
          console.log("[WhatsAppWorker] Dropped. waTicketResolvedEnabled is FALSE.");
          return;
        }
        const ticket = await Ticket.findById(data.ticketId).populate("userId");
        if (!ticket) throw new Error("Ticket not found");

        const phone = getPhone(ticket.userId);
        if (!phone) return;

        await sendTicketResolved(phone, {
          name: ticket.userId.name,
          ticket_id: ticket._id.toString(),
        });
        break;
      }

      case "trending": {
        if (!settings.waTrendingProductsEnabled) {
          console.log("[WhatsAppWorker] Dropped. waTrendingProductsEnabled is FALSE.");
          return;
        }
        const user = await UserProfile.findById(data.userId);
        const product = await Product.findById(data.productId);
        if (!user || !product) throw new Error("User or Product not found");

        const phone = getPhone(user);
        if (!phone) return;

        await sendTrendingProduct(phone, {
          name: user.name,
          product_name: product.name,
          price: `₹${product.price}`,
        });
        break;
      }

      case "reengagement": {
        if (!settings.waReEngagementEnabled) {
          console.log("[WhatsAppWorker] Dropped. waReEngagementEnabled is FALSE.");
          return;
        }
        const user = await UserProfile.findById(data.userId);
        if (!user) throw new Error("User not found");

        const phone = getPhone(user);
        if (!phone) return;

        await sendReEngagement(phone, {
          name: user.name,
        });

        // Update lastReEngagementSentAt & segment
        await UserProfile.findByIdAndUpdate(user._id, {
          $set: { lastReEngagementSentAt: new Date() },
          $addToSet: { segment: "at_risk" },
        });
        break;
      }

      case "payment_failure": {
        if (!settings.waPaymentFailureEnabled) {
          console.log("[WhatsAppWorker] Dropped. waPaymentFailureEnabled is FALSE.");
          return;
        }
        // Find Order by Razorpay Order ID
        const order = await Order.findOne({ razorpayOrderId: data.razorpayOrderId });
        if (!order) throw new Error("Order not found for razorpayOrderId: " + data.razorpayOrderId);

        const user = await UserProfile.findById(order.user);
        const phone = getPhone(user, order.shippingDetails?.phone);
        if (!phone) return;

        let paymentLinkUrl = order.paymentLink;

        // Generate payment link if not exists
        if (!paymentLinkUrl) {
          const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
          });

          const expireBy = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

          const customerObj = {
            name: order.user?.name || order.shippingDetails?.name || "Customer",
            contact: phone.replace("+91", ""),
          };
          const userEmail = order.user?.email || order.shippingDetails?.email;
          if (userEmail) customerObj.email = userEmail;

          const paymentLinkReq = {
            amount: Math.round(data.amount * 100),
            currency: "INR",
            accept_partial: false,
            description: `Payment for Bodilicious Order ${order._id}`,
            customer: customerObj,
            notify: { sms: false, email: false },
            reminder_enable: false,
            notes: { orderId: order._id.toString() },
            expire_by: expireBy
          };

          const paymentLinkRes = await razorpayInstance.paymentLink.create(paymentLinkReq);
          paymentLinkUrl = paymentLinkRes.short_url;

          order.paymentLinkId = paymentLinkRes.id;
          order.paymentLink = paymentLinkRes.short_url;
          await order.save();
        }

        // We can pass the short_url suffix to the template if it's dynamic, 
        // but Meta button URLs usually need a path param. If `retry_url_suffix` is used:
        // assuming short_url looks like "https://rzp.io/i/XXXXXX", we extract "i/XXXXXX"
        let suffix = "";
        try {
          const urlObj = new URL(paymentLinkUrl);
          suffix = urlObj.pathname.replace(/^\//, ''); // e.g. "i/XXXXX"
        } catch(e) {}

        await sendPaymentFailure(phone, {
          name: user?.name || order.shippingDetails?.name,
          amount: `₹${data.amount}`,
          retry_url_suffix: suffix,
        });
        break;
      }

      default:
        console.warn(`[WhatsApp Worker] Unknown job type: ${name}`);
    }
  } catch (error) {
    console.error(`[WhatsApp Worker] Job failed: ${error.message}`);
    throw error;
  }
};

export const startWhatsAppWorker = () => {
  const worker = new Worker("whatsappQueue", processJob, { 
    connection,
    drainDelay: 300000, // 5 minutes: delay before re-polling when queue is empty
    stalledInterval: 300000, // 5 minutes: check for stalled jobs less often
    metrics: { maxDataPoints: 0 } // Disable metrics writes to save commands
  });

  worker.on("completed", (job) => {
    console.log(`[WhatsApp Worker] Job ${job.id} completed!`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[WhatsApp Worker] Job ${job.id} failed with error: ${err.message}`);
  });

  console.log("[WhatsApp Worker] Started listening to whatsappQueue...");
};
