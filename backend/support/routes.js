import { Router } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import rateLimit from "express-rate-limit";
import { protect, adminOnly } from "../middleware/auth.js";
import {
  createTicket,
  getUserTickets,
  getUserTicketUnreadCount,
  updateTicketStatus,
  getFaqs,
  getAllTickets,
  addMessage,
  uploadSupportAttachment,
  deleteSupportAttachment,
  getTicketOrder
} from "./controller.js";

const router = Router();

// Configure multer memory storage for support ticket attachments (JPEG, PNG, WEBP, <= 5MB)
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'), false);
  }
};
const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Magic-byte verification to defend against MIME spoofing
const ALLOWED_MAGIC = new Set(["image/jpeg", "image/png", "image/webp"]);
const verifyFileType = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MAGIC.has(detected.mime)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file content. Only JPEG, PNG, and WEBP images are allowed. (Detected: ${detected?.mime ?? "unknown"})`
      });
    }
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: "File validation failed" });
  }
};

// Rate limiter for upload to protect against storage abuse (10 uploads per user per hour)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || "anonymous",
  message: {
    success: false,
    message: "Too many uploads. You can only upload up to 10 files per hour.",
  },
});

router.get("/faqs", getFaqs);

// Admin: fetch all tickets
router.get("/tickets", protect, adminOnly, getAllTickets);

// Customer: create ticket
router.post("/tickets", protect, createTicket);

// Customer: lightweight unread count (MUST be before /:userId to avoid param conflict)
router.get("/tickets/:userId/unread-count", protect, getUserTicketUnreadCount);

// Customer (or admin): fetch tickets by userId
router.get("/tickets/:userId", protect, getUserTickets);

// Both: update status
router.patch("/tickets/:id", protect, updateTicketStatus);

// Both: post a message to a ticket thread
router.post("/tickets/:id/messages", protect, addMessage);

// Admin: fetch ticket's brief order info
router.get("/tickets/:id/order", protect, adminOnly, getTicketOrder);

// Upload and delete attachments (for both customers and admins)
router.post("/upload", protect, uploadLimiter, upload.single("file"), verifyFileType, uploadSupportAttachment);
router.delete("/upload", protect, deleteSupportAttachment);

export default router;
