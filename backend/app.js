import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import { razorpayWebhook } from "./payment/controller.js";
import routes from "./index.js";

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

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://bodilicious.in",
    "https://www.bodilicious.in",
    "https://bodilicious.netlify.app/"
  ],
  credentials: true
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes."
  }
});

// Stricter limiter for sensitive endpoints (payment, profile)
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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
  express.raw({ type: "application/json" }),
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
app.use("/api/v1", globalLimiter, routes);
app.use("/api/v1/payment", sensitiveLimiter);
app.use("/api/v1/profile", sensitiveLimiter);

export default app;
