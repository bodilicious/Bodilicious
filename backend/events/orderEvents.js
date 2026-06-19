import EventEmitter from "events";
import { pushOrderToShiprocket } from "../tracker/shiprocketservice.js";
import { sendOrderConfirmationAfterInvoice, sendAdminNewOrderAlert } from "../email/emailService.js";
import UserProfile from "../profile/models.js";
import Order from "../tracker/models.js";
import { trackServerEvent } from "../utils/posthog.js";
import { enqueueWhatsApp } from "../whatsapp/queue.js";

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
        const isIndiaOrder = !order.shippingDetails?.country || 
            ['india', 'in', 'bharat', 'ind'].includes((order.shippingDetails.country || '').toLowerCase().trim());
        
        const distinctId = order.user ? order.user.toString() : order.shippingDetails?.email || "guest";
        trackServerEvent(distinctId, 'Order Completed', {
            order_id: order._id.toString(),
            total_amount: order.totalAmount,
            currency: order.currency || "INR",
            payment_method: order.paymentMethod,
            region: isIndiaOrder ? 'domestic' : 'international',
            items: order.items.map(item => ({
                product_id: item.product && item.product._id ? item.product._id.toString() : item.product.toString(),
                quantity: item.quantity,
                price: item.priceAtPurchase
            }))
        });

        // 2. Shiprocket Pushing (Only for India)
        if (isIndiaOrder) {
            pushOrderToShiprocket(order).catch(err => {
                console.error("[Order Events] Shiprocket push failed:", err.message);
            });
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

        // 4. WhatsApp Queueing
        try {
            const customerPhone = order.shippingDetails?.phone;
            if (customerPhone) {
                // Ensure international format (assuming Indian numbers if length is 10)
                const formattedPhone = customerPhone.replace(/\D/g, "");
                const waPhone = formattedPhone.length === 10 ? `91${formattedPhone}` : formattedPhone;

                await enqueueWhatsApp(waPhone, "order_confirmation", {
                    order_id: order._id.toString(),
                    total_amount: order.totalAmount.toString(),
                    customer_name: order.shippingDetails?.name || "Customer"
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
