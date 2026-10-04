import { Router } from "express";
const router = Router();

import { protect, adminOnly } from "../middleware/auth.js";
import { adminLimiter, adminReadLimiter, enforcePagination } from "../middleware/admin.js";

import * as notifCtrl from "./notificationController.js";
import * as insightsCtrl from "./insightsController.js";

const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

// Auth + admin guard + rate limiter, attached per route rather than with an unscoped
// router.use(). This router is mounted at "/admin" ahead of the main admin router, so a
// router-level guard ran on EVERY /admin/* request before passing it on: each admin call
// verified the token and synced the profile twice, and counted twice against the shared
// adminLimiter. Every new route here must include `adminGuard`.
const adminGuard = [protect, adminOnly, adminLimiter, noStore];

// ─── Notifications ────────────────────────────────────────────────────────────
// Specific routes MUST come before /:id routes
router.get("/notifications/unread-count", adminGuard, adminReadLimiter, notifCtrl.getUnreadCount);
router.patch("/notifications/read-all", adminGuard, notifCtrl.markAllRead);
router.get("/notifications", adminGuard, enforcePagination, notifCtrl.listNotifications);
router.patch("/notifications/:id/read", adminGuard, notifCtrl.markOneRead);

// ─── Insights ─────────────────────────────────────────────────────────────────
router.get("/insights/summary", adminGuard, adminReadLimiter, insightsCtrl.getSummary);
router.get("/insights/low-stock", adminGuard, insightsCtrl.getLowStock);

export default router;
