import express from "express";
import { 
  getExecutiveSummary, 
  getTrendingProducts, 
  getProductFunnel,
  getCohorts, 
  getLowStock,
  trackEvent,
  getCustomersAtRisk,
  getProductIntelligence,
  getMarketingAttribution,
  getSearchAnalytics,
  getInventoryForecast
} from "./controller.js";
import { liveStreamHandler } from "./live.js";
import { protect, adminOnly, tryProtect } from "../middleware/auth.js";

import rateLimit from "express-rate-limit";

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many tracking events" }
});

const router = express.Router();

// Public (guest-friendly) tracking endpoint — optional auth via tryProtect
router.post("/track", trackLimiter, tryProtect, trackEvent);

// All other analytics routes require admin auth — attached per route, not with an
// unscoped router.use(). This router is mounted at /admin/analytics ahead of the main
// admin router, which serves /admin/analytics/sales, /products, /customers etc.; a
// router-level guard ran on those requests too before passing them on, so each was
// authenticated twice. Every new route here must include `adminGuard`.
const adminGuard = [protect, adminOnly];

router.get("/executive-summary", adminGuard, getExecutiveSummary);
router.get("/trending-products", adminGuard, getTrendingProducts);
router.get("/product-funnel", adminGuard, getProductFunnel);
router.get("/cohorts", adminGuard, getCohorts);
router.get("/low-stock", adminGuard, getLowStock);
router.get("/customers-at-risk", adminGuard, getCustomersAtRisk);
router.get("/product-intelligence", adminGuard, getProductIntelligence);
router.get("/marketing", adminGuard, getMarketingAttribution);
router.get("/search-stats", adminGuard, getSearchAnalytics);
router.get("/inventory-forecast", adminGuard, getInventoryForecast);
router.get("/live", adminGuard, liveStreamHandler);

export default router;
