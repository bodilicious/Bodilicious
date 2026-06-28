import UserProfile from "./models.js";
import Product from "../products/models.js";
import Order from "../tracker/models.js";
import admin from "../config/firebaseAdmin.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../email/emailService.js";
import { logAction } from "../admin/controller.js";
/*
  GET PROFILE
  GET /api/v1/user
*/
export const getProfile = async (req, res) => {
  try {
    // Slim projections: only send what the frontend actually uses.
    // cartHistory and productViewCounts are analytics-only and never read by the client.
    const productCardFields = 'pid name price images rating ratingCount stock category brand';

    const user = await UserProfile.findById(req.user._id, {
      // Exclude heavy analytics arrays that the frontend never reads
      cartHistory: 0,
      productViewCounts: 0,
    })
      .populate('wishlist', productCardFields)
      .populate('cart.product', productCardFields)
      .populate({
        path: 'orders',
        options: { sort: { createdAt: -1 }, limit: 20 }, // cap at 20 most recent orders
        populate: {
          path: 'items.product',
          select: productCardFields,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error('GET PROFILE ERROR:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/*
  UPDATE PROFILE
*/
export const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      "name", "phone", "gender", "dateOfBirth",
      "skinType", "skinConcerns", "preferredRoutine"
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const updatedUser = await UserProfile.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updatedUser });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
  ADD TO WISHLIST
  POST /api/v1/user/wishlist
*/
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await UserProfile.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { wishlist: productId } }, // prevents duplicates
      { new: true }
    );

    res.json({ success: true, message: "Added to wishlist" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
  REMOVE FROM WISHLIST
  DELETE /api/v1/user/wishlist/:productId
*/
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ message: "Product ID required" });
    }

    const updatedUser = await UserProfile.findByIdAndUpdate(
      req.user._id,
      { $pull: { wishlist: productId } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, message: "Removed from wishlist" });
  } catch (err) {
    console.error("Wishlist delete error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
/*
  SYNC CART
  POST /api/v1/user/cart
*/
export const syncCart = async (req, res) => {
  try {
    const { cartItems } = req.body;

    if (!Array.isArray(cartItems)) {
      return res.status(400).json({ message: "Invalid cart payload" });
    }

    const user = await UserProfile.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const oldCartMap = new Map(user.cart.map(i => [i.product ? i.product.toString() : "unknown", i.quantity]));
    const newCartMap = new Map(cartItems.map(i => [i.productId ? i.productId.toString() : "unknown", i.quantity]));

    user.cart = cartItems.map(item => ({
      product: item.productId,
      quantity: item.quantity,
    }));

    user.cartUpdatedAt = new Date();

    await user.save();

    // 🚀 Audit Cart Changes & Update cartHistory
    const bulkOps = [];
    for (const [pid, newQty] of newCartMap.entries()) {
      const oldQty = oldCartMap.get(pid) || 0;
      if (newQty > oldQty) {
        const addedQty = newQty - oldQty;
        
        // Track cartHistory additions securely via $inc
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id, "cartHistory.productId": pid },
            update: {
              $inc: { "cartHistory.$.timesAdded": addedQty },
              $set: { "cartHistory.$.lastAddedAt": new Date() }
            }
          }
        });
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id, "cartHistory.productId": { $ne: pid } },
            update: {
              $push: {
                cartHistory: {
                  $each: [{
                    productId: pid,
                    timesAdded: addedQty,
                    lastAddedAt: new Date()
                  }],
                  $slice: -100
                }
              }
            }
          }
        });

        import("../analytics/interactionModel.js").then(({ default: UserInteractionLog }) => {
          UserInteractionLog.create({
            userId: user._id,
            productId: pid,
            eventType: "cart_add",
            quantity: addedQty
          }).catch(err => console.error(err));
        }).catch(err => console.error(err));

        logAction(req, "cart_item_added", "product", pid, {
          quantity_added: addedQty,
          total_quantity: newQty
        }).catch(err => console.error("Cart Item Added Audit Failed:", err));
      } else if (newQty < oldQty) {
        const removedQty = oldQty - newQty;
        
        // Track cartHistory removals
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id, "cartHistory.productId": pid },
            update: {
              $inc: { "cartHistory.$.timesRemoved": removedQty },
              $set: { "cartHistory.$.lastRemovedAt": new Date() }
            }
          }
        });
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id, "cartHistory.productId": { $ne: pid } },
            update: {
              $push: {
                cartHistory: {
                  $each: [{
                    productId: pid,
                    timesRemoved: removedQty,
                    lastRemovedAt: new Date()
                  }],
                  $slice: -100
                }
              }
            }
          }
        });

        import("../analytics/interactionModel.js").then(({ default: UserInteractionLog }) => {
          UserInteractionLog.create({
            userId: user._id,
            productId: pid,
            eventType: "cart_remove",
            quantity: removedQty
          }).catch(err => console.error(err));
        }).catch(err => console.error(err));

        logAction(req, "cart_item_removed", "product", pid, {
          quantity_removed: removedQty,
          total_quantity: newQty
        }).catch(err => console.error("Cart Item Removed Audit Failed:", err));
      }
    }
    
    for (const pid of oldCartMap.keys()) {
      if (!newCartMap.has(pid)) {
        const removedQty = oldCartMap.get(pid);
        
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id, "cartHistory.productId": pid },
            update: {
              $inc: { "cartHistory.$.timesRemoved": removedQty },
              $set: { "cartHistory.$.lastRemovedAt": new Date() }
            }
          }
        });
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id, "cartHistory.productId": { $ne: pid } },
            update: {
              $push: {
                cartHistory: {
                  $each: [{
                    productId: pid,
                    timesRemoved: removedQty,
                    lastRemovedAt: new Date()
                  }],
                  $slice: -100
                }
              }
            }
          }
        });

        import("../analytics/interactionModel.js").then(({ default: UserInteractionLog }) => {
          UserInteractionLog.create({
            userId: user._id,
            productId: pid,
            eventType: "cart_remove",
            quantity: removedQty
          }).catch(err => console.error(err));
        }).catch(err => console.error(err));

        logAction(req, "cart_item_removed", "product", pid, {
          quantity_removed: removedQty,
          total_quantity: 0
        }).catch(err => console.error("Cart Item Removed Audit Failed:", err));
      }
    }

    if (bulkOps.length > 0) {
      await UserProfile.bulkWrite(bulkOps).catch(err => console.error("Failed to bulk write cartHistory:", err));
    }

    const productCardFields = 'pid name price images rating ratingCount stock category brand';
    const userWithPopulatedCart = await UserProfile.findById(user._id)
      .populate('cart.product', productCardFields)
      .populate('wishlist', productCardFields);
    res.json({ success: true, cart: userWithPopulatedCart.cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
  GET MY ORDERS
*/
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id, orderStatus: { $ne: "abandoned" } })
      .sort({ createdAt: -1 })
      .select('items totalAmount orderStatus paymentStatus createdAt estimatedDeliveryDate returnStatus invoiceNumber awb shippingCost discountAmount originalAmount currency')
      .populate('items.product', 'name images price pid slug');

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
  GET RECENTLY BOUGHT
*/
export const getRecentlyBought = async (req, res) => {
  try {
    const productCardFields = 'pid name price images rating ratingCount stock category brand';
    const user = await UserProfile.findById(req.user._id)
      .populate('recentlyBought', productCardFields);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ success: true, data: user.recentlyBought });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
  ADDRESS MANAGEMENT
*/
export const addAddress = async (req, res) => {
  try {
    const { name, phone, houseNumber, addressLine, area, city, state, country, pincode, isDefault } = req.body;
    const user = await UserProfile.findById(req.user._id);

    // If it's the first address, or isDefault is true, make it default
    let makeDefault = isDefault || user.addresses.length === 0;

    if (makeDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push({
      name, phone, houseNumber, addressLine, area, city, state, country, pincode, isDefault: makeDefault
    });

    await user.save();
    res.status(201).json({ success: true, data: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { name, phone, houseNumber, addressLine, area, city, state, country, pincode, isDefault } = req.body;

    const user = await UserProfile.findById(req.user._id);
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
      address.isDefault = true;
    }

    if (name) address.name = name;
    if (phone) address.phone = phone;
    if (houseNumber !== undefined) address.houseNumber = houseNumber;
    if (addressLine) address.addressLine = addressLine;
    if (area !== undefined) address.area = area;
    if (city) address.city = city;
    if (state) address.state = state;
    if (country) address.country = country;
    if (pincode) address.pincode = pincode;

    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await UserProfile.findById(req.user._id);

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    const wasDefault = address.isDefault;
    user.addresses.pull(addressId);

    // If we deleted the default address, and we still have other addresses, make the first one default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await UserProfile.findById(req.user._id);

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    user.addresses.forEach(addr => addr.isDefault = false);
    address.isDefault = true;

    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
  TRIGGER EMAIL VERIFICATION
  POST /api/v1/user/send-verification
*/
export const triggerEmailVerification = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    console.log("Triggering verification for:", userEmail);

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: "User email not found in profile",
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || "https://www.bodilicious.in";
    console.log("Using FRONTEND_URL for link:", frontendUrl);

    // 1. Generate the standard Firebase verification link
    let firebaseLink;
    try {
      firebaseLink = await admin
        .auth()
        .generateEmailVerificationLink(userEmail);
    } catch (firebaseErr) {
      console.error("Firebase Link Gen Error:", firebaseErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to generate verification link from Firebase",
      });
    }

    // 2. Extract the oobCode from the Firebase link
    const url = new URL(firebaseLink);
    const oobCode = url.searchParams.get("oobCode");

    // 3. Construct our BRANDED link
    const brandedLink = `${frontendUrl}/auth/action?mode=verifyEmail&oobCode=${oobCode}`;
    console.log("Branded link generated:", brandedLink);

    try {
      await sendVerificationEmail(userEmail, brandedLink);
    } catch (emailErr) {
      console.error("Email Service Error:", emailErr.message);
      return res.status(500).json({
        success: false,
        message: "Link generated but failed to send email",
      });
    }

    console.log("Verification email sequence completed successfully.");
    return res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Unexpected verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
};

/*
  TRIGGER PASSWORD RESET
  POST /api/v1/user/forgot-password
*/
export const triggerPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const frontendUrl = process.env.FRONTEND_URL || "https://www.bodilicious.in";

    // 1. Generate the standard Firebase password reset link
    let firebaseLink;
    try {
      firebaseLink = await admin
        .auth()
        .generatePasswordResetLink(email);
    } catch (firebaseErr) {
      // Don't expose whether the email exists or not for security reasons
      if (firebaseErr.code === 'auth/user-not-found') {
        return res.json({ success: true, message: "If an account exists, a reset link was sent." });
      }
      throw firebaseErr;
    }

    // 2. Extract the oobCode from the Firebase link
    const url = new URL(firebaseLink);
    const oobCode = url.searchParams.get("oobCode");

    if (!oobCode) {
      throw new Error("Could not extract oobCode from Firebase reset link");
    }

    // 3. Construct our BRANDED link
    const brandedLink = `${frontendUrl}/auth/action?mode=resetPassword&oobCode=${oobCode}`;

    try {
      await sendPasswordResetEmail(email, brandedLink);
    } catch (emailErr) {
      console.error("Email Service Error:", {
        message: emailErr.message,
        code: emailErr.code,
        command: emailErr.command,
        response: emailErr.response,
        responseCode: emailErr.responseCode,
      });
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email.",
      });
    }

    return res.json({
      success: true,
      message: "If an account exists, a reset link was sent.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Password reset failed",
    });
  }
};