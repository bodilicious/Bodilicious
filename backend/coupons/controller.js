import { Coupon, CouponUse } from "./models.js";
import Order from "../tracker/models.js";
import { logAction } from "../admin/controller.js";

/**
 * GET /api/v1/admin/coupons
 */
export const getCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { active } = req.query; // 'true' | 'false' | undefined

    const query = {};
    if (active === "true") query.isActive = true;
    if (active === "false") query.isActive = false;

    const [coupons, total] = await Promise.all([
      Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments(query),
    ]);

    res.json({ success: true, data: coupons, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("GetCoupons Error:", err);
    res.status(500).json({ success: false, message: "Error fetching coupons" });
  }
};

/**
 * POST /api/v1/admin/coupons
 */
export const createCoupon = async (req, res) => {
  try {
    const { code, type, value, minOrderValue, perUserLimit, totalCap, allowsStacking, expiresAt, description } = req.body;

    if (!code || !type) {
      return res.status(400).json({ success: false, message: "code and type are required" });
    }
    if (type === "percentage" && (value < 1 || value > 100)) {
      return res.status(400).json({ success: false, message: "Percentage value must be between 1 and 100" });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: `Coupon code "${code.toUpperCase()}" already exists` });
    }

    const coupon = await Coupon.create({
      code, type, value, minOrderValue, perUserLimit, totalCap, allowsStacking, expiresAt, description, isActive: true,
    });

    await logAction(req, "coupon_created", "coupon", coupon._id.toString(), { code: coupon.code, type, value });
    res.status(201).json({ success: true, data: coupon });
  } catch (err) {
    console.error("CreateCoupon Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/v1/admin/coupons/:id
 */
export const updateCoupon = async (req, res) => {
  try {
    const { code, type, value, minOrderValue, perUserLimit, totalCap, allowsStacking, expiresAt, description, isActive } = req.body;
    const allowedFields = Object.fromEntries(
      Object.entries({ code, type, value, minOrderValue, perUserLimit, totalCap, allowsStacking, expiresAt, description, isActive })
      .filter(([, v]) => v !== undefined)
    );
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: allowedFields }, { new: true, runValidators: true });
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

    await logAction(req, "coupon_updated", "coupon", coupon._id.toString(), req.body);
    res.json({ success: true, data: coupon });
  } catch (err) {
    console.error("UpdateCoupon Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/v1/admin/coupons/bulk-deactivate
 */
export const bulkDeactivate = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids must be a non-empty array" });
    }

    const result = await Coupon.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
    await logAction(req, "coupons_bulk_deactivated", "coupon", "multiple", { count: result.modifiedCount, ids });
    res.json({ success: true, deactivated: result.modifiedCount });
  } catch (err) {
    console.error("BulkDeactivate Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/coupons/expiring
 * Coupons expiring within 7 days.
 */
export const getExpiringCoupons = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const now = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const coupons = await Coupon.find({
      isActive: true,
      expiresAt: { $gte: now, $lte: threshold },
    }).sort({ expiresAt: 1 });

    res.json({ success: true, data: coupons });
  } catch (err) {
    console.error("ExpiringCoupons Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/coupons/:id/stats
 * Total uses, revenue attributed, AOV, daily usage last 30 days.
 */
export const getCouponStats = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [aggregated, dailyUsage] = await Promise.all([
      CouponUse.aggregate([
        { $match: { coupon: coupon._id } },
        {
          $group: {
            _id: null,
            totalUses: { $sum: 1 },
            totalRevenue: { $sum: "$orderTotal" },
            totalDiscount: { $sum: "$discountApplied" },
          },
        },
      ]),
      CouponUse.aggregate([
        { $match: { coupon: coupon._id, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const stats = aggregated[0] || { totalUses: 0, totalRevenue: 0, totalDiscount: 0 };
    const aov = stats.totalUses > 0 ? parseFloat((stats.totalRevenue / stats.totalUses).toFixed(2)) : 0;

    res.json({
      success: true,
      data: {
        coupon,
        totalUses: stats.totalUses,
        totalRevenue: stats.totalRevenue,
        totalDiscount: stats.totalDiscount,
        averageOrderValue: aov,
        dailyUsage, // [{ _id: "2024-01-01", count: 5 }, ...]
      },
    });
  } catch (err) {
    console.error("CouponStats Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Checkout helper — validate coupon and check stacking.
 * Returns { valid, coupon, error }.
 */
export const validateCouponAtCheckout = async (code, cartTotal, userId, activeCouponIds = []) => {
  try {
    if (!code || typeof code !== 'string') return { valid: false, error: "Invalid coupon code" };
    const normalizedCode = code.toUpperCase().trim();
    if (!normalizedCode) return { valid: false, error: "Invalid coupon code" };

    const coupon = await Coupon.findOne({ code: normalizedCode, isActive: true });
    if (!coupon) return { valid: false, error: "Coupon not found or inactive" };

    // Expiry
    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
      return { valid: false, error: "This coupon has expired" };
    }

    // Min order value
    if (cartTotal < coupon.minOrderValue) {
      return { valid: false, error: `Minimum order value of ${coupon.minOrderValue} required to use this coupon` };
    }

    // Total cap
    if (coupon.totalCap !== null && coupon.usageCount >= coupon.totalCap) {
      return { valid: false, error: "This coupon has reached its maximum usage limit" };
    }

    // Per-user limit
    if (coupon.perUserLimit !== null) {
      const userUseCount = await CouponUse.countDocuments({ coupon: coupon._id, user: userId });
      if (userUseCount >= coupon.perUserLimit) {
        return { valid: false, error: "You have reached the usage limit for this coupon" };
      }
    }

    // Stacking check
    if (activeCouponIds.length > 0) {
      const activeCoupons = await Coupon.find({ _id: { $in: activeCouponIds } });
      const anyNoStack = activeCoupons.some((c) => !c.allowsStacking);
      if (anyNoStack || !coupon.allowsStacking) {
        return { valid: false, error: "This coupon cannot be combined with other coupons" };
      }
    }

    return { valid: true, coupon };
  } catch (err) {
    console.error("ValidateCoupon Error:", err);
    return { valid: false, error: "Error validating coupon" };
  }
};
