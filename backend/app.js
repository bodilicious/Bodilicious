import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import compression from "compression";
import zlib from "zlib";
import { razorpayWebhook } from "./payment/controller.js";
import { trackActiveSession } from "./analytics/live.js";
import routes from "./index.js";

const app = express();

// Health check for UptimeRobot (keeps the free Render instance awake). Registered
// first so pings skip every middleware below — previously each ping ran helmet,
// CORS, body parsing and the live-visitor tracker, and showed up as an "active
// visitor" on the admin live dashboard. Body-less 200; no-store so no edge caches it.
app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).end();
});

// Brotli when the client supports it (all modern browsers), gzip otherwise.
// Brotli q4 compresses JSON smaller than gzip at a fraction of the CPU of the old
// gzip level 9 — which matters on a 0.1-CPU free instance. Brotli's own default
// (q11) would be far slower still, hence the explicit quality.
app.use(compression({
  threshold: 1024,
  level: 6,
  brotli: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } },
}));
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
    "https://bodilicious.netlify.app",
    "https://bodilicious-front.onrender.com"
  ],
  credentials: true
}));

// In-memory rate limiters — intentionally NOT Redis-backed.
// The shared Redis instance is reserved for BullMQ queues/workers which
// require persistent connections. Free-tier Redis caps concurrent
// connections, so we avoid burning one just for counters.
// Per-dyno in-memory limiting is still highly effective: each dyno
// enforces its own window, and limits are set conservatively enough
// that even split traffic across dynos stays well-controlled.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // ~2 req/sec — plenty for real users, stingy for bots
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 1 minute."
  }
});

const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many quote requests, please wait a moment before retrying."
  }
});

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests on this endpoint, please try again later."
  }
});

// ⚠️  IMPORTANT: Webhook must use raw body (not JSON-parsed) for HMAC to work correctly.
// Register BEFORE express.json() so the raw Buffer is preserved for signature verification.
app.post("/api/v1/payment/webhook",
  express.raw({ type: "application/json", limit: "4mb" }),
  (req, res, next) => {
    // Expose raw buffer as req.rawBody for the controller
    req.rawBody = req.body;
    // Parse body to object for the route handler to use
    try { req.body = JSON.parse(req.body.toString()); } catch { req.body = {}; }
    next();
  },
  razorpayWebhook
);

// 4 MB covers larger payloads (e.g. product imports). Upload routes use multer
// (multipart/form-data) and are unaffected by this limit.
// The WhatsApp webhook needs the exact bytes Meta signed to verify
// X-Hub-Signature-256. Capture the raw buffer for that path only — holding a
// reference for every API request would waste memory for no benefit.
// (Razorpay's webhook is registered above with express.raw and sets its own rawBody.)
app.use(express.json({
  limit: "4mb",
  verify: (req, res, buf) => {
    const url = req.originalUrl || req.url || "";
    if (url.startsWith("/api/v1/whatsapp/webhook")) req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: "4mb", extended: true }));
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

// Global Error Handler to prevent Express from sending HTML 500 pages
app.use((err, req, res, next) => {
  console.error("Unhandled API Error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === "production" && status === 500 
      ? "Internal Server Error" 
      : (err.message || "Internal Server Error"),
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
});

export default app;
