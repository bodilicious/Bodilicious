import { Router } from "express";
const router = Router();

import { protect, adminOnly, primaryAdminOnly } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/admin.js";
import { getSettings, getAdminSettings, updateSettings } from "./controller.js";

// Public route to get non-sensitive store settings
router.get("/public", getSettings);

// Admin routes
router.use(protect);
router.use(adminOnly);
router.use(adminLimiter);

router.get("/", getAdminSettings);
router.put("/", primaryAdminOnly, updateSettings);

export default router;
