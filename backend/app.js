import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import { razorpayWebhook } from "./payment/controller.js";
import { trackActiveSession } from "./analytics/live.js";
import routes from "./index.js";

// Dedicated ioredis client for rate limiting
const rateLimitRedisClient = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
if (!rateLimitRedisClient) {
  console.warn("⚠️ REDIS_URL not set. Rate limiting will fall back to memory store if RedisStore fails.");
}

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://checkout.razorpay.com", "https://cdn.razorpay.com"],
      frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://api.razorpay.com"],
    },
  },
}));

app.set("trust proxy", 1);
app.use(trackActiveSession);

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://bodilicious.in",
    "https://www.bodilicious.in",
    "https://bodilicious.netlify.app"
  ],
  credentials: true
}));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  ...(rateLimitRedisClient && { store: new RedisStore({ sendCommand: (...args) => rateLimitRedisClient.call(...args), prefix: 'rl:global:' }) }),
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 1 minute."
  }
});

// Quote endpoint: price calculation only — called on shipping page, payment page,
// and on tab-focus. High limit since it moves no money and is expected to be frequent.
const quoteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  ...(rateLimitRedisClient && { store: new RedisStore({ sendCommand: (...args) => rateLimitRedisClient.call(...args), prefix: 'rl:quote:' }) }),
  message: {
    success: false,
    message: "Too many quote requests, please wait a moment before retrying."
  }
});

// Strict limiter only for endpoints that actually move money or create accounts.
// Intentionally kept tight — these should never be called more than a handful
// of times per checkout session.
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  ...(rateLimitRedisClient && { store: new RedisStore({ sendCommand: (...args) => rateLimitRedisClient.call(...args), prefix: 'rl:sensitive:' }) }),
  message: {
    success: false,
    message: "Too many requests on this endpoint, please try again later."
  }
});

// ⚠️  IMPORTANT: Webhook must use raw body (not JSON-parsed) for HMAC to work correctly.
// Register BEFORE express.json() so the raw Buffer is preserved for signature verification.
app.post("/api/v1/payment/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res, next) => {
    // Expose raw buffer as req.rawBody for the controller
    req.rawBody = req.body;
    // Parse body to object for the route handler to use
    try { req.body = JSON.parse(req.body.toString()); } catch { req.body = {}; }
    next();
  },
  razorpayWebhook
);

app.use(express.json());
// Custom integration for express-mongo-sanitize to avoid read-only getter crash on req.query
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.query) mongoSanitize.sanitize(req.query);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});
// ⚠️  Order matters: specific sub-paths must be registered BEFORE the catch-all
// /api/v1 route, otherwise Express has already matched them and these never fire.

// /quote — price calculator, called on shipping + payment pages and tab-focus
app.use("/api/v1/payment/quote", (req, res, next) => {
    if (req.body && req.body.couponCode) {
        return sensitiveLimiter(req, res, next);
    }
    return quoteLimiter(req, res, next);
});

// Actual money-moving endpoints — strict limit
app.use("/api/v1/payment/razorpay/init", sensitiveLimiter);
app.use("/api/v1/payment/verify", sensitiveLimiter);

// Everything else under /api/v1 (includes remaining /payment/* like /webhook)
app.use("/api/v1", globalLimiter, routes);

// Health check endpoint for UptimeRobot
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

export default app;
