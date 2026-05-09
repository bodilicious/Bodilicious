import { Router } from "express";
const router = Router();

import { protect, adminOnly } from "../middleware/auth.js";
import { adminLimiter, adminReadLimiter, enforcePagination } from "../middleware/admin.js";

import * as notifCtrl from "./notificationController.js";
import * as insightsCtrl from "./insightsController.js";

// Apply auth + admin guard + rate limiter to all procurement routes
router.use(protect);
router.use(adminOnly);
router.use(adminLimiter);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// ─── Notifications ────────────────────────────────────────────────────────────
// Specific routes MUST come before /:id routes
router.get("/notifications/unread-count", adminReadLimiter, notifCtrl.getUnreadCount);
router.patch("/notifications/read-all", notifCtrl.markAllRead);
router.get("/notifications", enforcePagination, notifCtrl.listNotifications);
router.patch("/notifications/:id/read", notifCtrl.markOneRead);

// ─── Insights ─────────────────────────────────────────────────────────────────
router.get("/insights/summary", adminReadLimiter, insightsCtrl.getSummary);
router.get("/insights/low-stock", insightsCtrl.getLowStock);

export default router;
