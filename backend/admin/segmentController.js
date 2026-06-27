import mongoose from "mongoose";
import UserProfile from "../profile/models.js";
import Product from "../products/models.js";
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
          orderStatus: { $nin: ["cancelled", "returned", "return_requested", "abandoned"] },
          $or: [
            { paymentStatus: "paid" },
            { orderStatus: "delivered" }
          ]
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
        { $match: { 
            orderStatus: { $nin: ["cancelled", "returned", "return_requested", "abandoned"] },
            $or: [
              { paymentStatus: "paid" },
              { orderStatus: "delivered" }
            ]
        } },
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
                orderStatus: { $nin: ["cancelled", "returned", "return_requested", "abandoned"] },
                $or: [
                  { paymentStatus: "paid" },
                  { orderStatus: "delivered" }
                ]
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
        { $match: { 
            user: user._id, 
            orderStatus: { $nin: ["cancelled", "returned", "return_requested", "abandoned"] },
            $or: [
              { paymentStatus: "paid" },
              { orderStatus: "delivered" }
            ]
        } },
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

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER ANALYSIS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER ANALYSIS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────
import { Ticket } from "../support/models.js";
import UserSession from "../audit/sessionModel.js";
import AuditLogV2 from "../audit/models.js";

/**
 * GET /api/v1/admin/customers/:id/summary
 * Fast endpoint: identity, segment tags, KPI metrics, and 12-month LTV trend.
 * All aggregations run in parallel — target <200ms for typical catalogs.
 */
export const getCustomerSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await UserProfile.findById(
      id,
      "name email phone avatar segment lifetimeSpend adminNotes createdAt lastLoginAt isBlocked role skinType skinConcerns preferredRoutine gender dateOfBirth lifetimeSessions cartHistory productViewCounts"
    ).lean();
    if (!user) return res.status(404).json({ success: false, message: "Customer not found" });

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [kpiAgg, statusBreakdown, ltvTrend] = await Promise.all([
      // KPI aggregation: total spend, order count, AOV, cancel count, return count
      Order.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: null,
            totalSpend: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0] },
            },
            orderCount: { $sum: 1 },
            paidOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
            cancelledOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } },
            returnedOrders: {
              $sum: {
                $cond: [
                  { $in: ["$orderStatus", ["returned", "return_requested"]] },
                  1,
                  0,
                ],
              },
            },
            firstOrderAt: { $min: "$createdAt" },
            lastOrderAt: { $max: "$createdAt" },
          },
        },
      ]),
      // Order status breakdown for the donut chart
      Order.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // LTV trend: paid spend per month for the last 12 months
      Order.aggregate([
        {
          $match: {
            user: user._id,
            paymentStatus: "paid",
            orderStatus: { $ne: "cancelled" },
            createdAt: { $gte: twelveMonthsAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            spend: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const kpi = kpiAgg[0] || {
      totalSpend: 0,
      orderCount: 0,
      paidOrders: 0,
      cancelledOrders: 0,
      returnedOrders: 0,
      firstOrderAt: null,
      lastOrderAt: null,
    };

    const aov = kpi.paidOrders > 0 ? kpi.totalSpend / kpi.paidOrders : 0;
    const cancelRate =
      kpi.orderCount > 0
        ? parseFloat(((kpi.cancelledOrders / kpi.orderCount) * 100).toFixed(1))
        : 0;
    const returnRate =
      kpi.orderCount > 0
        ? parseFloat(((kpi.returnedOrders / kpi.orderCount) * 100).toFixed(1))
        : 0;

    res.json({
      success: true,
      data: {
        user,
        kpi: {
          totalSpend: kpi.totalSpend,
          orderCount: kpi.orderCount,
          paidOrders: kpi.paidOrders,
          cancelledOrders: kpi.cancelledOrders,
          returnedOrders: kpi.returnedOrders,
          aov: parseFloat(aov.toFixed(2)),
          cancelRate,
          returnRate,
          firstOrderAt: kpi.firstOrderAt,
          lastOrderAt: kpi.lastOrderAt,
        },
        statusBreakdown,
        ltvTrend,
      },
    });
  } catch (err) {
    console.error("CustomerSummary Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/orders?page=1&limit=10
 * Server-paginated order list with populated product items.
 */
export const getCustomerOrders = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await UserProfile.findById(id, "_id").lean();
    if (!user) return res.status(404).json({ success: false, message: "Customer not found" });

    const [orders, total] = await Promise.all([
      Order.find({ user: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("items.product", "name pid images price")
        .lean(),
      Order.countDocuments({ user: user._id }),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { page, pages: Math.ceil(total / limit), total },
    });
  } catch (err) {
    console.error("CustomerOrders Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/reviews
 * All reviews this user has left across all products.
 * Uses the sparse index { "reviews.user": 1 } on the Product collection.
 */
export const getCustomerReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = (await import("mongoose")).default;
    const objectId = mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
    if (!objectId) return res.status(400).json({ success: false, message: "Invalid user ID" });

    // Fetch products that contain at least one review from this user
    const products = await Product.find(
      { "reviews.user": objectId },
      "name pid images reviews"
    ).lean();

    // Extract and flatten only the reviews belonging to this user
    const reviews = [];
    for (const product of products) {
      const userReviews = (product.reviews || []).filter(
        (r) => r.user?.toString() === id
      );
      for (const r of userReviews) {
        reviews.push({
          _id: r._id,
          productId: product._id,
          productName: product.name,
          productPid: product.pid,
          productImage: product.images?.[0] || null,
          rating: r.rating,
          comment: r.comment,
          isVerified: r.isVerified,
          createdAt: r.createdAt,
        });
      }
    }

    // Sort by newest first
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: reviews, total: reviews.length });
  } catch (err) {
    console.error("CustomerReviews Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/tickets
 * All support tickets raised by this customer.
 */
export const getCustomerTickets = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await UserProfile.findById(id, "_id").lean();
    if (!user) return res.status(404).json({ success: false, message: "Customer not found" });

    const tickets = await Ticket.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      cancelled: tickets.filter((t) => t.status === "cancelled").length,
      avgResolutionDays: (() => {
        const resolved = tickets.filter((t) => t.resolvedAt);
        if (resolved.length === 0) return null;
        const totalDays = resolved.reduce(
          (sum, t) =>
            sum + (new Date(t.resolvedAt) - new Date(t.createdAt)) / 86400000,
          0
        );
        return parseFloat((totalDays / resolved.length).toFixed(1));
      })(),
    };

    // Scrub message bodies — return only metadata (count, last message date)
    const safeTickets = tickets.map((t) => ({
      _id: t._id,
      ticketId: t.ticketId,
      type: t.type,
      status: t.status,
      priority: t.priority,
      description: t.description,
      messageCount: (t.messages || []).length,
      lastMessageAt: t.messages?.length
        ? t.messages[t.messages.length - 1].createdAt
        : null,
      resolvedAt: t.resolvedAt,
      createdAt: t.createdAt,
    }));

    res.json({ success: true, data: safeTickets, stats });
  } catch (err) {
    console.error("CustomerTickets Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/cart
 * Current cart contents, wishlist, and detailed skin profile.
 */
export const getCustomerCart = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await UserProfile.findById(id)
      .populate("cart.product", "name pid images price stock isActive")
      .populate("wishlist", "name pid images price stock isActive")
      .lean();

    if (!user) return res.status(404).json({ success: false, message: "Customer not found" });

    const cartValue = (user.cart || []).reduce((sum, item) => {
      const price = item.product?.price || 0;
      return sum + price * (item.quantity || 1);
    }, 0);

    res.json({
      success: true,
      data: {
        cart: user.cart || [],
        cartItemCount: (user.cart || []).length,
        cartValue: parseFloat(cartValue.toFixed(2)),
        wishlist: user.wishlist || [],
        skinProfile: {
          skinType: user.skinType || null,
          skinConcerns: user.skinConcerns || [],
          preferredRoutine: user.preferredRoutine || null,
          gender: user.gender || null,
          dateOfBirth: user.dateOfBirth || null,
        },
        addresses: user.addresses || [],
      },
    });
  } catch (err) {
    console.error("CustomerCart Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/cart-history
 */
export const getCustomerCartHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Optional date filter
    const query = {
      user_id: id,
      event_type: { $in: ["CART_ITEM_ADDED", "CART_ITEM_REMOVED"] }
    };
    if (req.query.startDate && req.query.endDate) {
      query.timestamp_utc = { 
        $gte: new Date(req.query.startDate), 
        $lte: new Date(req.query.endDate) 
      };
    }

    const [rawLogs, total] = await Promise.all([
      AuditLogV2.find(query)
        .sort({ timestamp_utc: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLogV2.countDocuments(query)
    ]);

    // Enrich logs with product name from targetId if missing
    const productIds = rawLogs
      .map(l => l.metadata?.targetId)
      .filter(id => id && mongoose.isValidObjectId(id));
      
    const products = await Product.find({ _id: { $in: productIds } }, "name").lean();
    const productMap = {};
    products.forEach(p => productMap[p._id.toString()] = p.name);

    const logs = rawLogs.map(log => {
      if (log.metadata && log.metadata.targetId && productMap[log.metadata.targetId.toString()]) {
        log.metadata.productName = log.metadata.productName || productMap[log.metadata.targetId.toString()];
      }
      return log;
    });

    const user = await UserProfile.findById(id).populate("cartHistory.productId", "name").lean();

    res.json({
      success: true,
      data: logs,
      aggregatedData: user?.cartHistory || [],
      pagination: { page, pages: Math.ceil(total / limit), total }
    });
  } catch (err) {
    console.error("CartHistory Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/payment-history
 */
export const getCustomerPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch from Orders
    const orders = await Order.find({ user: id })
      .sort({ createdAt: -1 })
      .select('orderId totalAmount paymentStatus paymentMethod createdAt orderStatus')
      .lean();
      
    // Fetch PAYMENT_FAILED from AuditLogV2
    const failedLogs = await AuditLogV2.find({
      user_id: id,
      event_type: "PAYMENT_FAILED"
    }).sort({ timestamp_utc: -1 }).lean();

    res.json({
      success: true,
      data: {
        orders,
        failedAttempts: failedLogs
      }
    });
  } catch (err) {
    console.error("PaymentHistory Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/activity
 * Estimates session durations based on first/last event per session_id.
 */
export const getCustomerActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const mongoose = (await import("mongoose")).default;
    const objectId = mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
    if (!objectId) return res.status(400).json({ success: false, message: "Invalid user ID" });

    const { startDate, endDate } = req.query;
    const query = { user_id: objectId };
    if (startDate && endDate) {
      query.start_time = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const total = await UserSession.countDocuments(query);
    const rawSessions = await UserSession.find(query)
      .sort({ start_time: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Resolve stale/crashed sessions and map to frontend shape
    const resolvedSessions = UserSession.resolveStaleSessions(rawSessions);
    
    const mappedSessions = resolvedSessions.map(s => ({
      _id: s.session_id,
      startTime: s.start_time,
      endTime: s.end_time,
      durationMs: s.durationMs,
      network: s.network
    }));

    res.json({
      success: true,
      data: mappedSessions,
      pagination: { page, pages: Math.ceil(total / limit), total }
    });
  } catch (err) {
    console.error("CustomerActivity Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/audit
 */
export const getCustomerAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const { startDate, endDate, eventType } = req.query;
    const query = { user_id: id };
    
    if (eventType) {
      query.event_type = eventType;
    }
    if (startDate && endDate) {
      query.timestamp_utc = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const [rawLogs, total] = await Promise.all([
      AuditLogV2.find(query)
        .sort({ timestamp_utc: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLogV2.countDocuments(query)
    ]);

    // Enrich logs with product name from targetId if missing
    const productIds = rawLogs
      .map(l => l.metadata?.targetId)
      .filter(id => id && mongoose.isValidObjectId(id));
      
    const products = await Product.find({ _id: { $in: productIds } }, "name").lean();
    const productMap = {};
    products.forEach(p => productMap[p._id.toString()] = p.name);

    const logs = rawLogs.map(log => {
      if (log.metadata && log.metadata.targetId && productMap[log.metadata.targetId.toString()]) {
        log.metadata.productName = log.metadata.productName || productMap[log.metadata.targetId.toString()];
      }
      return log;
    });

    res.json({
      success: true,
      data: logs,
      pagination: { page, pages: Math.ceil(total / limit), total }
    });
  } catch (err) {
    console.error("CustomerAuditLogs Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/customers/:id/engagement
 * Lazy-loaded engagement analytics
 */
export const getCustomerEngagement = async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
    if (!objectId) return res.status(400).json({ success: false, message: "Invalid user ID" });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [sessionAgg, orderAgg] = await Promise.all([
      UserSession.aggregate([
        { $match: { user_id: objectId, start_time: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: null,
            totalDurationMs: { $sum: "$durationMs" },
            sessionCount: { $sum: 1 },
          }
        }
      ]),
      Order.aggregate([
        { $match: { user: objectId } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            paidOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
            failedOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0] } },
            couponUsageCount: {
              $sum: { $cond: [{ $ifNull: ["$coupon", false] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const sessionData = sessionAgg[0] || { totalDurationMs: 0, sessionCount: 0 };
    const orderData = orderAgg[0] || { totalOrders: 0, paidOrders: 0, failedOrders: 0, couponUsageCount: 0 };

    res.json({
      success: true,
      data: {
        sessions6m: {
          totalDurationMs: sessionData.totalDurationMs,
          sessionCount: sessionData.sessionCount,
          averageDurationMs: sessionData.sessionCount > 0 ? Math.floor(sessionData.totalDurationMs / sessionData.sessionCount) : 0
        },
        orders: {
          totalOrders: orderData.totalOrders,
          paidOrders: orderData.paidOrders,
          failedOrders: orderData.failedOrders,
          couponUsageCount: orderData.couponUsageCount,
          successRate: orderData.totalOrders > 0 ? parseFloat(((orderData.paidOrders / orderData.totalOrders) * 100).toFixed(1)) : 0
        }
      }
    });
  } catch (err) {
    console.error("CustomerEngagement Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
