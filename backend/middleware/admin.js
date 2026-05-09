import rateLimit from "express-rate-limit";

// General admin rate limiter — raised to 300/min to support background polling
// and normal multi-page admin use without hitting 429s
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many admin requests. Please wait a minute.",
  },
});

// Lenient limiter for lightweight polling endpoints (e.g. unread-count, summary)
// These are read-only GET endpoints with no mutation risk
export const adminReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests.",
  },
});

// Enforce pagination limits for all admin list routes
export const enforcePagination = (req, res, next) => {
  let limit = parseInt(req.query.limit) || 20;
  let page = parseInt(req.query.page) || 1;

  // Max limit and sanitization
  limit = Math.min(Math.max(limit, 1), 100);
  page = Math.max(page, 1);

  req.pagination = {
    limit,
    page,
    skip: (page - 1) * limit
  };

  next();
};
