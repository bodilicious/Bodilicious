import { Router } from "express";
const router = Router();

import { protect, adminOnly, primaryAdminOnly } from "../middleware/auth.js";
import { adminLimiter, enforcePagination } from "../middleware/admin.js";
import * as adminCtrl from "./controller.js";
import * as analyticsCtrl from "./analyticsController.js";
import * as segmentCtrl from "./segmentController.js";
import { generatePaymentLink } from "../payment/controller.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileTypeFromBuffer } from "file-type";

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'), false);
  }
};
const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Magic-byte verification middleware — runs AFTER multer saves the file to memory.
// Defends against MIME spoofing: a client claiming image/jpeg but uploading HTML/PHP.
const ALLOWED_MAGIC = new Set(["image/jpeg", "image/png", "image/webp"]);
const verifyFileType = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MAGIC.has(detected.mime)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file content. Only JPEG, PNG, and WEBP images are allowed. (Detected: ${detected?.mime ?? "unknown"})`
      });
    }
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: "File validation failed" });
  }
};

// Apply protection and no-cache to all admin routes
router.use(protect);
router.use(adminOnly);
router.use(adminLimiter);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Dashboard
router.get("/dashboard/summary", adminCtrl.getDashboardSummary);
router.get("/dashboard/recent-orders", enforcePagination, adminCtrl.getRecentOrders);
router.get("/sidebar-badges", adminCtrl.getNotificationCounts);

// Uploads (magic-byte validated)
router.post("/upload", upload.single("image"), verifyFileType, adminCtrl.uploadImage);

// Logs & Exports
router.get("/logs/export", adminCtrl.exportLogsCSV);
router.get("/logs", enforcePagination, adminCtrl.getLogsAdmin);
router.get("/orders/export", adminCtrl.exportOrdersCSV);

// Analytics
router.get("/analytics/sales", analyticsCtrl.getSalesAnalytics);
router.get("/analytics/products", analyticsCtrl.getProductAnalytics);
router.get("/analytics/inventory", analyticsCtrl.getInventoryAnalytics);
router.get("/analytics/customers", analyticsCtrl.getCustomerAnalytics);
router.get("/analytics/operations", analyticsCtrl.getOperationAnalytics);
router.get("/analytics/ritual-finder", analyticsCtrl.getRitualAnalytics);
router.get("/analytics/orders", analyticsCtrl.getOrderAnalytics);
router.get("/analytics/behavioral", analyticsCtrl.getBehavioralAnalytics);

// Products — bulk routes MUST come before /:id routes
router.post("/products/bulk-stock", adminCtrl.bulkStockImport);
router.patch("/products/bulk-status", adminCtrl.bulkUpdateProductStatus);
router.get("/products/low-stock", adminCtrl.getLowStockProducts);
router.get("/products/:id/stock-history", adminCtrl.getProductStockHistory);
router.get("/products", enforcePagination, adminCtrl.getAllProductsAdmin);
router.post("/products", adminCtrl.createProductAdmin);
router.put("/products/:id", adminCtrl.updateProductAdmin);
router.patch("/products/:id/status", adminCtrl.toggleProductStatus);

// Orders — bulk routes and custom endpoints MUST come before /:id routes
router.get("/orders/abandoned-checkouts", enforcePagination, adminCtrl.getAbandonedCheckouts);
router.post("/orders/draft", adminCtrl.createDraftOrder);
router.post("/orders/:id/payment-link", generatePaymentLink);
router.patch("/orders/bulk-status", adminCtrl.bulkUpdateOrderStatus);
router.get("/orders", enforcePagination, adminCtrl.getAllOrdersAdmin);
router.get("/orders/:id", adminCtrl.getOrderByIdAdmin);
router.patch("/orders/:id/status", adminCtrl.updateOrderStatusAdmin);
router.post("/orders/:id/push-shiprocket", adminCtrl.adminPushShiprocket);
router.post("/orders/:id/sync-shiprocket", adminCtrl.adminSyncShiprocket);

// Users
router.get("/users", enforcePagination, adminCtrl.getAllUsersAdmin);
router.get("/users/:id/orders", adminCtrl.getCustomerOrderHistory);
router.patch("/users/:id/block", adminCtrl.toggleUserBlock);
router.patch("/users/:id/role", primaryAdminOnly, adminCtrl.updateUserRole);

// Segments & CRM — specific routes before /:id
router.post("/segments/compute", segmentCtrl.triggerSegmentCompute);
router.get("/segments/stats", segmentCtrl.getSegmentStats);
router.get("/segments/customers", enforcePagination, segmentCtrl.getSegmentCustomers);
router.get("/segments/:segment/export", segmentCtrl.exportSegmentCSV);

// Customer analysis — specific sub-routes MUST come before /:id/profile and /:id/notes
router.get("/customers/:id/summary",  segmentCtrl.getCustomerSummary);
router.get("/customers/:id/orders",   segmentCtrl.getCustomerOrders);
router.get("/customers/:id/reviews",  segmentCtrl.getCustomerReviews);
router.get("/customers/:id/tickets",  segmentCtrl.getCustomerTickets);
router.get("/customers/:id/cart",     segmentCtrl.getCustomerCart);
router.get("/customers/:id/cart-history", segmentCtrl.getCustomerCartHistory);
router.get("/customers/:id/payment-history", segmentCtrl.getCustomerPaymentHistory);
router.get("/customers/:id/activity", segmentCtrl.getCustomerActivity);
router.get("/customers/:id/audit",    segmentCtrl.getCustomerAuditLogs);
router.get("/customers/:id/engagement", segmentCtrl.getCustomerEngagement);
router.get("/customers/:id/profile",  segmentCtrl.getCustomerProfile);
router.patch("/customers/:id/notes",  segmentCtrl.updateAdminNotes);

export default router;


