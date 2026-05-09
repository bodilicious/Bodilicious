import express from "express";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

import {
  getProfile,
  updateProfile,
  addToWishlist,
  removeFromWishlist,
  getRecentlyBought,
  getMyOrders,
  syncCart,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  triggerEmailVerification,
} from "./controller.js";

import UserProfile from "./models.js";
import { updateUserProfileSchema } from "./schema.js";

const router = express.Router();

/*
  BASE: /api/v1/user
*/

// PROFILE
router.get("/", protect, getProfile);
router.put("/", protect, validate(updateUserProfileSchema), updateProfile);
router.delete("/", protect, async (req, res) => {
  const deleted = await UserProfile.findByIdAndDelete(req.user._id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  res.json({ success: true, message: "Account deleted" });
});

// WISHLIST
router.get("/wishlist", protect, async (req, res) => {
  const user = await UserProfile.findById(req.user._id).populate("wishlist");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  res.json({ success: true, data: user.wishlist });
});
router.post("/wishlist", protect, addToWishlist);
router.delete("/wishlist/:productId", protect, removeFromWishlist);

// ORDERS
router.get("/orders", protect, getMyOrders);
router.get("/recent", protect, getRecentlyBought);

// CART
router.post("/cart", protect, syncCart);

// ADDRESSES
router.post("/address", protect, addAddress);
router.put("/address/:addressId", protect, updateAddress);
router.delete("/address/:addressId", protect, deleteAddress);
router.patch("/address/:addressId/default", protect, setDefaultAddress);
router.post("/send-verification", protect, triggerEmailVerification);

export default router;