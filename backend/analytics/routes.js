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
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";

const rateLimitRedisClient = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  ...(rateLimitRedisClient && { store: new RedisStore({ sendCommand: (...args) => rateLimitRedisClient.call(...args), prefix: 'rl:track:' }) }),
  message: { success: false, message: "Too many tracking events" }
});

const router = express.Router();

// Public (guest-friendly) tracking endpoint — optional auth via tryProtect
router.post("/track", trackLimiter, tryProtect, trackEvent);

// All other analytics routes require admin auth
router.use(protect, adminOnly);

router.get("/executive-summary", getExecutiveSummary);
router.get("/trending-products", getTrendingProducts);
router.get("/product-funnel", getProductFunnel);
router.get("/cohorts", getCohorts);
router.get("/low-stock", getLowStock);
router.get("/customers-at-risk", getCustomersAtRisk);
router.get("/product-intelligence", getProductIntelligence);
router.get("/marketing", getMarketingAttribution);
router.get("/search-stats", getSearchAnalytics);
router.get("/inventory-forecast", getInventoryForecast);
router.get("/live", liveStreamHandler);

export default router;
