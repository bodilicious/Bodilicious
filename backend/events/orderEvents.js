import EventEmitter from "events";
import { pushOrderToShiprocket, isIndiaOrder } from "../tracker/shiprocketservice.js";
import NotificationService from "../procurement/notificationService.js";
import { sendOrderConfirmationAfterInvoice, sendAdminNewOrderAlert } from "../email/emailService.js";
import UserProfile from "../profile/models.js";
import Order from "../tracker/models.js";
import { trackServerEvent } from "../utils/posthog.js";
import { enqueueWhatsApp } from "../whatsapp/queue.js";
import { getSettings } from "../settings/cache.js";

class OrderEmitter extends EventEmitter {}
const orderEvents = new OrderEmitter();

// Handle successful order placements (both COD and Razorpay)
// Compute segments dynamically
const updateSegments = async (order) => {
    if (order && order.user) {
        try {
            const { computeSegmentsForUsers } = await import("../admin/segmentController.js");
            await computeSegmentsForUsers([order.user]);
        } catch (err) {
            console.error("[Order Events] Failed to compute segments:", err.message);
        }
    }
};

orderEvents.on("order_placed", async (order) => {
    try {
        await updateSegments(order);

        // 1. PostHog Tracking
        const isDomestic = isIndiaOrder(order);

        const distinctId = order.user ? order.user.toString() : order.shippingDetails?.email || "guest";
        trackServerEvent(distinctId, 'Order Completed', {
            order_id: order._id.toString(),
            total_amount: order.totalAmount,
            currency: order.currency || "INR",
            payment_method: order.paymentMethod,
            region: isDomestic ? 'domestic' : 'international',
            items: order.items.map(item => ({
                product_id: item.product && item.product._id ? item.product._id.toString() : item.product.toString(),
                quantity: item.quantity,
                price: item.priceAtPurchase
            }))
        });

        // 2. Fulfilment
        if (isDomestic) {
            // India → Shiprocket handles it automatically.
            pushOrderToShiprocket(order).catch(err => {
                console.error("[Order Events] Shiprocket push failed:", err.message);
            });
        } else {
            // International → no carrier integration exists. Without this the order
            // would sit at "pending" with no shipment, no AWB and no signal to ops.
            // Flag it and raise a notification so it enters the manual queue.
            const country = order.shippingDetails?.country || "Unknown";
            await Order.updateOne(
                { _id: order._id },
                { $set: {
                    needsManualReview: true,
                    reviewReason: `International order (${country}) — no automated carrier. Arrange shipment manually.`
                }}
            ).catch(err => console.error("[Order Events] Failed to flag international order:", err.message));

            await NotificationService.emit({
                title: "International Order — Manual Fulfilment Required",
                body: `Order ${order._id.toString().slice(-6).toUpperCase()} ships to ${country} (${order.currency || "INR"} ${order.totalAmount}). Shiprocket does not cover this destination — book a carrier manually.`,
                type: "warning",
                sourceModule: "orders",
                sourceModel: "Order",
                sourceId: order._id.toString()
            }).catch(err => console.error("[Order Events] International notification failed:", err.message));
        }

        // 3. Email Generation
        try {
            // Re-fetch order to get the invoice number that might have been saved synchronously right after the event was emitted
            const freshOrder = await Order.findById(order._id).populate("items.product");
            const user = freshOrder.user ? await UserProfile.findById(freshOrder.user) : null;
            await sendOrderConfirmationAfterInvoice(freshOrder, user?.email);
            await sendAdminNewOrderAlert(freshOrder);
        } catch (err) {
            console.error("[Order Events] Email dispatch failed:", err.message);
        }

        // 4. WhatsApp Queueing — skip entirely if WhatsApp is disabled
        try {
            const waSettings = await getSettings();
            if (waSettings.waAllEnabled) {
                await enqueueWhatsApp("order_placed", {
                    userId: order.user.toString(),
                    orderId: order._id.toString()
                });
            }
        } catch (err) {
            console.error("[Order Events] WhatsApp enqueue failed:", err.message);
        }

    } catch (err) {
        console.error("[Order Events] Unhandled error in order_placed event:", err);
    }
});

// Update segments on status change
orderEvents.on("order_status_updated", async (order) => {
    await updateSegments(order);
});

export default orderEvents;
