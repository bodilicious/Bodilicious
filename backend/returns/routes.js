import { Router } from "express";
const router = Router();

import { protect, adminOnly } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/admin.js";
import * as returnsCtrl from "./controller.js";

router.use(protect);
router.use(adminOnly);
router.use(adminLimiter);

// Analytics must come BEFORE /:id routes
router.get("/analytics", returnsCtrl.getReturnAnalytics);

router.get("/", returnsCtrl.getReturnsQueue);
router.patch("/:id/approve", returnsCtrl.approveReturn);
router.patch("/:id/reject", returnsCtrl.rejectReturn);
router.patch("/:id/received", returnsCtrl.markReceived);

export default router;
