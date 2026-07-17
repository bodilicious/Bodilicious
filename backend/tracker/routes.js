import express from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createOrderSchema } from "./schema.js";

import {
  createOrder,
  getMyOrders,
  getOrderStatusLite,
  getSingleOrder,
  cancelOrder,
  deleteOrder,
  trackShiprocketOrder,
  updateShippingAddress,
  updateOrderStatus,
  requestReturn,
  shiprocketWebhook,
  addOrderComment,
} from "./controller.js";


const router = express.Router();

/*
  ORDERS / TRACKER
  Base: /api/orders
*/

// =============================
// CREATE ORDER
// POST /api/orders
// =============================
router.post("/", protect, validate(createOrderSchema), createOrder);

// =============================
// GET MY ORDERS
// GET /api/orders
// =============================
router.get("/", protect, getMyOrders);

// =============================
// SHIPROCKET WEBHOOK
// POST /api/orders/webhook/shipping
// ⚠ Must be ABOVE /:orderId route
// =============================
router.post("/webhook/shipping", shiprocketWebhook);

// =============================
// TRACK ORDER (Shiprocket)
// GET /api/orders/shiprocket/:awb
// ⚠ Must be ABOVE :orderId route
// =============================
router.get("/shiprocket/:awb", protect, trackShiprocketOrder);

// =============================
// GET ORDER STATUS LITE
// GET /api/orders/:orderId/status
// =============================
router.get("/:orderId/status", protect, getOrderStatusLite);

// =============================
// GET SINGLE ORDER
// GET /api/orders/:orderId
// =============================
router.get("/:orderId", protect, getSingleOrder);

// =============================
// UPDATE SHIPPING ADDRESS
// PATCH /api/orders/:orderId/address
// =============================
router.patch("/:orderId/address", protect, updateShippingAddress);

// =============================
// CANCEL ORDER
// PATCH /api/orders/:orderId/cancel
// =============================
router.patch("/:orderId/cancel", protect, cancelOrder);

// =============================
// SOFT DELETE ORDER
// DELETE /api/orders/:orderId
// =============================
router.delete("/:orderId", protect, deleteOrder);

// =============================
// UPDATE ORDER STATUS (Admin)
// PATCH /api/orders/:orderId/status
// =============================
router.patch("/:orderId/status", protect, adminOnly, updateOrderStatus);

// =============================
// REQUEST RETURN
// POST /api/orders/:orderId/return
// =============================
router.post("/:orderId/return", protect, requestReturn);

// =============================
// ADD CUSTOMER COMMENT
// POST /api/orders/:orderId/comment
// =============================
router.post("/:orderId/comment", protect, addOrderComment);

// (Shiprocket webhook moved above /:orderId routes to prevent route conflict)


export default router;