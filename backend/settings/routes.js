import { Router } from "express";
const router = Router();

import { protect, adminOnly, primaryAdminOnly } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/admin.js";
import { getSettings, getAdminSettings, updateSettings, getHomepageContent, getHomepageDraft, updateHomepageDraft, publishHomepageContent, revertHomepageDraft } from "./controller.js";

// Public route to get non-sensitive store settings
router.get("/public", getSettings);
router.get("/homepage", getHomepageContent);

// Admin routes
router.use(protect);
router.use(adminOnly);
router.use(adminLimiter);

router.get("/", getAdminSettings);
router.put("/", primaryAdminOnly, updateSettings);

router.get("/homepage/draft", getHomepageDraft);
router.put("/homepage/draft", updateHomepageDraft);
router.post("/homepage/publish", publishHomepageContent);
router.post("/homepage/discard", revertHomepageDraft);

export default router;
