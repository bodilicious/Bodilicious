import UserProfile from "../profile/models.js";
import Order from "../tracker/models.js";
import { exportToCSV } from "../utils/exportCSV.js";
import { logAction } from "./controller.js";

const HIGH_VALUE_THRESHOLD = parseInt(process.env.HIGH_VALUE_THRESHOLD) || 5000;
const LOYAL_ORDER_COUNT = 3;
const AT_RISK_DAYS = 60;
const NEW_DAYS = 30;

/**
 * Core segment computation logic.
 * Accepts a userId array (or null for all users).
 * Returns the number of users updated.
 */
export const computeSegmentsForUsers = async (userIds = null) => {
  const query = userIds ? { _id: { $in: userIds } } : {};
  const users = await UserProfile.find(query, "_id").lean();
  let updated = 0;

  const now = new Date();
  const newCutoff = new Date(now - NEW_DAYS * 86400000);
  const atRiskCutoff = new Date(now - AT_RISK_DAYS * 86400000);

  for (const user of users) {
    const [summary] = await Order.aggregate([
      {
        $match: {
          user: user._id,
          paymentStatus: "paid",
          orderStatus: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          lifetimeSpend: { $sum: "$totalAmount" },
          firstOrderAt: { $min: "$createdAt" },
          lastOrderAt: { $max: "$createdAt" },
        },
      },
    ]);

    const tags = [];
    if (summary) {
      const { orderCount, lifetimeSpend, firstOrderAt, lastOrderAt } = summary;
      if (firstOrderAt >= newCutoff) tags.push("new");
      if (orderCount >= LOYAL_ORDER_COUNT) tags.push("loyal");
      if (lastOrderAt <= atRiskCutoff && orderCount > 0) tags.push("at_risk");
      if (lifetimeSpend >= HIGH_VALUE_THRESHOLD) tags.push("high_value");

      await UserProfile.findByIdAndUpdate(user._id, {
        segment: tags,
        lifetimeSpend: lifetimeSpend || 0,
      });
    } else {
      // No orders — clear segments
      await UserProfile.findByIdAndUpdate(user._id, { segment: [], lifetimeSpend: 0 });
    }
    updated++;
  }

  return updated;
};

/**
 * POST /api/v1/admin/segments/compute
 * Manual trigger to recompute all segment tags.
 */
export const triggerSegmentCompute = async (req, res) => {
  try {
    const count = await computeSegmentsForUsers(null);
    await logAction(req, "segment_compute", "user", "all", { usersUpdated: count });
    res.json({ success: true, message: `Segments recomputed for ${count} users` });
  } catch (err) {
    console.error("SegmentCompute Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/segments/stats
 * Aggregate stats per segment: count, AOV, revenue share.
 */
export const getSegmentStats = async (req, res) => {
  try {
    const segments = ["new", "loyal", "at_risk", "high_value"];

    const [totalRevenueAgg, segmentAggs] = await Promise.all([
      Order.aggregate([
        { $match: { paymentStatus: "paid", orderStatus: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Promise.all(
        segments.map(async (seg) => {
          const usersInSeg = await UserProfile.find({ segment: seg }, "_id").lean();
          const userIds = usersInSeg.map((u) => u._id);

          const [agg] = await Order.aggregate([
            {
              $match: {
                user: { $in: userIds },
                paymentStatus: "paid",
                orderStatus: { $ne: "cancelled" },
              },
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: "$totalAmount" },
                orderCount: { $sum: 1 },
              },
            },
          ]);

          return {
            segment: seg,
            customerCount: userIds.length,
            revenue: agg?.revenue || 0,
            orderCount: agg?.orderCount || 0,
            aov: agg && agg.orderCount > 0 ? parseFloat((agg.revenue / agg.orderCount).toFixed(2)) : 0,
          };
        })
      ),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    const statsWithShare = segmentAggs.map((s) => ({
      ...s,
      revenueShare: totalRevenue > 0 ? parseFloat(((s.revenue / totalRevenue) * 100).toFixed(1)) : 0,
    }));

    res.json({ success: true, data: statsWithShare, totalRevenue });
  } catch (err) {
    console.error("SegmentStats Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/segments/customers?segment=loyal&page=1&limit=20
 */
export const getSegmentCustomers = async (req, res) => {
  try {
    const { segment, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (segment) query.segment = segment;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      UserProfile.find(query, "name email segment lifetimeSpend createdAt lastLoginAt isBlocked")
        .sort({ lifetimeSpend: -1 })
        .skip(skip)
        .limit(limit),
      UserProfile.countDocuments(query),
    ]);

    res.json({ success: true, data: users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("SegmentCustomers Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/profile
 * Full CRM profile: contact, segments, order history, lifetime stats, adminNotes.
 */
export const getCustomerProfile = async (req, res) => {
  try {
    const user = await UserProfile.findById(
      req.params.id,
      "name email phone avatar segment lifetimeSpend adminNotes createdAt lastLoginAt isBlocked role"
    );
    if (!user) return res.status(404).json({ success: false, message: "Customer not found" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [orders, orderTotal, lifetime] = await Promise.all([
      Order.find({ user: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("items.product", "name pid images")
        .lean(),
      Order.countDocuments({ user: user._id }),
      Order.aggregate([
        { $match: { user: user._id, paymentStatus: "paid", orderStatus: { $ne: "cancelled" } } },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: "$totalAmount" },
            orderCount: { $sum: 1 },
            firstOrderAt: { $min: "$createdAt" },
            lastOrderAt: { $max: "$createdAt" },
          },
        },
      ]),
    ]);

    const stats = lifetime[0] || { totalSpend: 0, orderCount: 0, firstOrderAt: null, lastOrderAt: null };

    res.json({
      success: true,
      data: {
        user,
        stats,
        orders,
        pagination: { page, pages: Math.ceil(orderTotal / limit), total: orderTotal },
      },
    });
  } catch (err) {
    console.error("CustomerProfile Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/v1/admin/customers/:id/notes
 */
export const updateAdminNotes = async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const user = await UserProfile.findByIdAndUpdate(
      req.params.id,
      { adminNotes },
      { new: true, select: "adminNotes name" }
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    console.error("UpdateAdminNotes Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/segments/:segment/export
 * Stream CSV download of customers in a segment.
 */
export const exportSegmentCSV = async (req, res) => {
  try {
    const { segment } = req.params;
    const validSegments = ["new", "loyal", "at_risk", "high_value", "all"];
    if (!validSegments.includes(segment)) {
      return res.status(400).json({ success: false, message: "Invalid segment" });
    }

    const query = segment === "all" ? {} : { segment };
    const users = await UserProfile.find(
      query,
      "name email segment lifetimeSpend createdAt lastLoginAt"
    ).lean();

    const rows = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      segments: (u.segment || []).join("|"),
      lifetimeSpend: u.lifetimeSpend || 0,
      memberSince: u.createdAt ? new Date(u.createdAt).toISOString().split("T")[0] : "",
      lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().split("T")[0] : "",
    }));

    const columns = [
      { key: "id", label: "Customer ID" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "segments", label: "Segments" },
      { key: "lifetimeSpend", label: "Lifetime Spend (INR)" },
      { key: "memberSince", label: "Member Since" },
      { key: "lastLogin", label: "Last Login" },
    ];

    exportToCSV(res, rows, `customers_${segment}_${Date.now()}`, columns);

    await logAction(req, "segment_export", "user", segment, { count: rows.length });
  } catch (err) {
    console.error("ExportSegmentCSV Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
