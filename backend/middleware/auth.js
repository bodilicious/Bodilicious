import admin from "../config/firebaseAdmin.js";
import UserProfile from "../profile/models.js";
import { logAction } from "../admin/controller.js";

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. No token.",
      });
    }

    const token = header.split(" ")[1];

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (firebaseErr) {
      console.error("Firebase token verification failed:", firebaseErr.message);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    try {
      const result = await UserProfile.findOneAndUpdate(
        { firebaseUID: decoded.uid },
        {
          $setOnInsert: {
            firebaseUID: decoded.uid,
            name: decoded.name || "User",
          },
          $set: {
            email: decoded.email || "",
            emailVerified: decoded.email_verified || false,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          includeResultMetadata: true,
        }
      );

      const user = result.value;

      if (result.lastErrorObject?.upserted) {
        logAction(req, "new_customer", "user", user._id.toString(), {
          email: user.email,
          name: user.name
        }).catch(err => console.error("New Customer Audit Failed:", err));
      }

      await UserProfile.findByIdAndUpdate(user._id, {
        $set: { lastLoginAt: new Date() }
      });

      req.user = user;
      req.userVerified = user.emailVerified;

      next();
    } catch (dbErr) {
      console.error("MongoDB user profile sync failed:", dbErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to sync user profile",
      });
    }
  } catch (err) {
    console.error("Unexpected Auth Middleware Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication",
    });
  }
};

/**
 * Same as protect, but doesn't block if no token or invalid token provided.
 * Useful for logging events for anonymous users while linking them to their profile if logged in.
 */
export const tryProtect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return next();
    }

    const token = header.split(" ")[1];

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (firebaseErr) {
      // Don't block, just move on
      return next();
    }

    try {
      const result = await UserProfile.findOneAndUpdate(
        { firebaseUID: decoded.uid },
        {
          $setOnInsert: {
            firebaseUID: decoded.uid,
            name: decoded.name || "User",
          },
          $set: {
            email: decoded.email || "",
            emailVerified: decoded.email_verified || false,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          includeResultMetadata: true,
        }
      );

      const user = result.value;

      if (result.lastErrorObject?.upserted) {
        logAction(req, "new_customer", "user", user._id.toString(), {
          email: user.email,
          name: user.name
        }).catch(err => console.error("New Customer Audit Failed (tryProtect):", err));
      }

      await UserProfile.findByIdAndUpdate(user._id, {
        $set: { lastLoginAt: new Date() }
      });

      req.user = user;
      next();
    } catch (dbErr) {
      // Database error still justifies an error response if we were trying to sync
      console.error("MongoDB user profile sync failed (tryProtect):", dbErr.message);
      next();
    }
  } catch (err) {
    next();
  }
};

export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user || !req.userVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address to perform this action.",
    });
  }
  next();
};

export const adminOnly = async (req, res, next) => {
  try {
    // req.user is already populated by protect middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Always fetch fresh status from DB to prevent token-only role trust
    const user = await UserProfile.findById(req.user._id);

    if (!user || !["admin", "primary_admin"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact support.",
      });
    }

    // Attach the fresh user so downstream middleware/controllers can read .role
    req.user = user;
    next();
  } catch (err) {
    console.error("Admin Middleware Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error during admin validation",
    });
  }
};

/**
 * Middleware: Only Primary Admins may pass.
 * Must be used AFTER protect + adminOnly (req.user is already fresh).
 */
export const primaryAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "primary_admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Primary Admin privileges required.",
    });
  }
  next();
};