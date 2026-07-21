import { Router } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import rateLimit from "express-rate-limit";
import { protect, adminOnly } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/admin.js";
import * as blogCtrl from "./controller.js";

const router = Router();

// ── Multer (memory storage — same pattern as admin upload) ──────────────────
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG, PNG, and WEBP are allowed."), false);
  }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Magic-byte verification — defends against MIME spoofing
const ALLOWED_MAGIC = new Set(["image/jpeg", "image/png", "image/webp"]);
const verifyFileType = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MAGIC.has(detected.mime)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file content. Only JPEG, PNG, and WEBP images are allowed. (Detected: ${detected?.mime ?? "unknown"})`,
      });
    }
    next();
  } catch {
    return res.status(500).json({ success: false, message: "File validation failed" });
  }
};

// ── Admin routes — all behind protect + adminOnly ───────────────────────────
const adminRouter = Router();
adminRouter.use(protect, adminOnly, adminLimiter);
adminRouter.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// IMPORTANT: static sub-paths BEFORE /:id to prevent Express matching "upload-image" as an ID
adminRouter.post("/upload-image", upload.single("image"), verifyFileType, blogCtrl.uploadBlogImage);
adminRouter.get("/",    blogCtrl.getAdminBlogs);
adminRouter.post("/",   blogCtrl.createBlog);
adminRouter.get("/:id",    blogCtrl.getAdminBlogById);
adminRouter.put("/:id",    blogCtrl.updateBlog);
adminRouter.delete("/:id", blogCtrl.deleteBlog);

// ── Public rate limiters ─────────────────────────────────────────────────────
// Per-user limiter for comment posting — keyed by user ID to avoid
// shared-IP false positives (e.g. corporate NAT users)
const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5,              // max 5 comments per user per minute
  keyGenerator: (req) => (req.user?._id?.toString() || req.ip),
  message: { success: false, message: "Too many comments. Please wait before posting again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Admin category routes ───────────────────────────────────────────────────
const categoryRouter = Router();
categoryRouter.use(protect, adminOnly, adminLimiter);
categoryRouter.get("/",     blogCtrl.getCategories);
categoryRouter.post("/",    blogCtrl.createCategory);
categoryRouter.delete("/:id", blogCtrl.deleteCategory);

// ── Public routes — no auth ─────────────────────────────────────────────────
const publicRouter = Router();
publicRouter.get("/",       blogCtrl.getPublicBlogs);
publicRouter.get("/categories", blogCtrl.getCategories);
publicRouter.get("/:slug",  blogCtrl.getPublicBlogBySlug);
publicRouter.get("/:slug/related", blogCtrl.getRelatedBlogs);
publicRouter.get("/:id/comments", blogCtrl.getComments);
publicRouter.post("/:id/comments", protect, commentLimiter, blogCtrl.addComment);

export { adminRouter, categoryRouter, publicRouter };
