import { Router } from "express";
const router = Router();

import { protect, adminOnly } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/admin.js";
import * as couponCtrl from "./controller.js";

router.use(protect);
router.use(adminOnly);
router.use(adminLimiter);

// Specific sub-routes MUST come before /:id routes
router.get("/expiring", couponCtrl.getExpiringCoupons);
router.patch("/bulk-deactivate", couponCtrl.bulkDeactivate);

router.get("/", couponCtrl.getCoupons);
router.post("/", couponCtrl.createCoupon);
router.put("/:id", couponCtrl.updateCoupon);
router.get("/:id/stats", couponCtrl.getCouponStats);

export default router;
