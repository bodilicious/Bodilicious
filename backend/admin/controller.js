import Order, { ORDER_ITEM_PRODUCT_FIELDS } from "../tracker/models.js";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";
import StoreSettings from "../settings/models.js";
import admin from "../config/firebaseAdmin.js";
import { v2 as cloudinary } from "cloudinary";
import AuditLogV2 from "../audit/models.js";
import { logAuditEvent } from "../audit/logger.js";
import mongoose from "mongoose";
import { pushOrderToShiprocket as srPush, getShiprocketToken } from "../tracker/shiprocketservice.js";
import { Ticket } from "../support/models.js";
import escapeStringRegexp from "escape-string-regexp";
import path from "path";
import _redis from "../utils/redis.js";
import { toRazorpayMinorUnits, fromRazorpayMinorUnits } from "../utils/currencies.js";
import { parseRangeStart, parseRangeEnd } from "../utils/dateRange.js";
import { releaseCouponUsage } from "../coupons/controller.js";
import { calculateInclusiveTax } from "../utils/pricing.js";
import { clearAuthCache } from "../middleware/auth.js";

// Use the shared singleton; fall back to a no-op object if Redis is unavailable.
// All methods return Promises because every call site uses await.
const redis = _redis ?? {
  get: () => Promise.resolve(null),
  setex: () => Promise.resolve(),
  del: () => Promise.resolve(),
  incr: () => Promise.resolve(0),
};

/**
 * How long an unpaid online checkout sits before we call it abandoned.
 * Matches the 30-minute quote expiry and the draft-cleanup cron, so the admin views
 * and the cron agree on what "abandoned" means.
 */
const ABANDONED_WINDOW_MS = 30 * 60 * 1000;

/**
 * Cloudinary folder the media library uploads to, lists and deletes from. One constant
 * so the three can't disagree: delete used to check against
 * `CLOUDINARY_FOLDER || "bodilicious"`, which no listed image ("bodilicious_products/…")
 * could ever match, so every delete was rejected as unauthorized.
 */
const MEDIA_FOLDER = "bodilicious_products";

/**
 * A storefront online checkout that hasn't been paid: the Razorpay modal is still
 * open, was closed, or the payment failed. initRazorpayOrder writes the order row
 * before the modal opens, so every cancelled payment leaves one of these behind.
 * They aren't orders yet, so every admin order view hides them as soon as they're
 * created. Using only the age-gated abandoned filter showed each cancelled payment
 * as a "pending" order for its first 30 minutes, which looked like a paid order
 * waiting to ship.
 *
 * `needsManualReview` is deliberately excluded. When a payment is captured but order
 * creation fails, the claim is reverted to pending/failed and the order is flagged —
 * which otherwise looks exactly like an unpaid checkout. Those are the opposite: the
 * customer's money is gone and ops must see them.
 *
 * `orderStatus` covers both states an unpaid checkout can be in: "pending" before
 * the draft-cleanup cron (cron/draftOrders.js) reaches it, and "abandoned" after the
 * cron relabels it.
 */
const unpaidOnlineCheckoutFilter = () => ({
  paymentMethod: { $ne: "cod" },          // COD is never "unpaid" in this sense
  source: { $ne: "admin_draft" },         // admin-created drafts aren't customer checkouts
  orderStatus: { $in: ["pending", "abandoned"] },
  paymentStatus: { $in: ["pending", "failed"] },
  needsManualReview: { $ne: true },       // money captured, order stuck — keep visible
});

/**
 * The single definition of an abandoned checkout: an unpaid one old enough that the
 * customer has walked away. Younger ones may still be mid-payment, so they're hidden
 * from the order views but not yet listed here.
 *
 * Built fresh on each call rather than held as a module constant: `createdAt` is
 * relative to now, and a constant would freeze the cutoff at server-boot time and
 * silently widen every day the process stayed up.
 */
const abandonedCheckoutFilter = () => ({
  ...unpaidOnlineCheckoutFilter(),
  createdAt: { $lt: new Date(Date.now() - ABANDONED_WINDOW_MS) },
});

/**
 * Helper to log administrative actions
 */
export const logAction = async (req, action, entity, entityId, details, options = {}) => {
  try {
    const adminId = options.adminId || (["admin", "primary_admin"].includes(req?.user?.role) ? req.user._id : undefined);
    const userId = options.userId || (req?.user?.role === "user" ? req.user._id : undefined);
    
    // Extract meta from details if it exists
    const detailsMeta = details?.meta || {};
    const resolvedSource = options.source || detailsMeta.source || (adminId ? "admin" : (userId ? "customer" : "system"));

    await logAuditEvent({
      event_type: action.toUpperCase(),
      user_id: adminId || userId,
      session_id: req?.sessionID || null,
      severity: options.severity || "INFO",
      source_system: resolvedSource === "admin" ? "backend-api" : "frontend",
      correlation_id: entityId !== "multiple" && entityId !== "all" ? entityId : null,
      request_id: req?.headers?.['x-request-id'] || null,
      network: {
        ip_address: req?.ip || req?.headers?.["x-forwarded-for"] || req?.connection?.remoteAddress,
        user_agent: req?.headers?.["user-agent"]
      },
      metadata: {
        targetType: entity,
        targetId: entityId,
        before: details?.before || null,
        after: details?.after || null,
        reason: options.reason || detailsMeta.reason || null
      }
    });
  } catch (err) {
    console.error("Audit Logging Failed:", err.message);
  }
};

/**
 * GET /api/v1/admin/dashboard/summary
 *
 * Cached for 5 minutes — this scans the full Order and AuditLogV2 collections.
 * Re-scanning on every admin page open was generating hundreds of MB of Atlas→Render
 * wire traffic per day even with zero real users.
 */
const DASHBOARD_CACHE_TTL = 900; // 15 minutes — admin only, staleness is acceptable
let _dashboardMemCache = null; // fallback when Redis is unavailable
let _dashboardMemCacheAt = 0;

export const getDashboardSummary = async (req, res) => {
  // ── 1. Serve from cache if fresh ─────────────────────────────────────────
  const CACHE_KEY = 'admin:dashboard:summary';
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached), cached: true });
    }
  } catch (_) {
    // Redis miss or unavailable — try in-memory fallback
    if (_dashboardMemCache && (Date.now() - _dashboardMemCacheAt) < DASHBOARD_CACHE_TTL * 1000) {
      return res.json({ success: true, data: _dashboardMemCache, cached: true });
    }
  }

  try {
    const [
      revenueData,
      totalOrders,
      totalUsers,
      pendingShipments,
      lowStockCount,
      outOfStockCount,
      recentActivity,
      categorySales
    ] = await Promise.all([
      // Revenue (sum of totalAmount for paid orders)
      Order.aggregate([
        { $match: { paymentStatus: "paid", orderStatus: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      // Total Orders (excludes cancelled orders and unpaid online checkouts)
      Order.countDocuments({
        orderStatus: { $ne: "cancelled" },
        $nor: [unpaidOnlineCheckoutFilter()]
      }),
      // Total Users
      UserProfile.countDocuments(),
      // Pending Shipments (status = processing)
      Order.countDocuments({ orderStatus: "processing" }),
      // Low Stock
      Product.countDocuments({
        stock: { $gt: 0, $lte: 5 }, // Default threshold
        isActive: true
      }),
      // Out of Stock
      Product.countDocuments({
        stock: 0,
        isActive: true
      }),
      // Recent Administrative Activity
      AuditLogV2.find({ "metadata.targetType": { $exists: true } })
        .populate("user_id", "name")
        .sort({ timestamp_utc: -1 })
        .limit(5),
      // Category Distribution
      Product.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } }
      ])
    ]);

    const totalRevenue = revenueData[0]?.total || 0;
    const aov = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

    const payload = {
      totalRevenue,
      totalOrders,
      totalUsers,
      pendingShipments,
      lowStockCount,
      outOfStockCount,
      averageOrderValue: parseFloat(aov),
      recentActivity,
      categorySales
    };

    // ── 2. Write to cache ───────────────────────────────────────────────────
    try {
      await redis.setex(CACHE_KEY, DASHBOARD_CACHE_TTL, JSON.stringify(payload));
    } catch (_) {
      _dashboardMemCache = payload;
      _dashboardMemCacheAt = Date.now();
    }

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error("Dashboard Summary Error:", err);
    res.status(500).json({ success: false, message: "Error fetching dashboard summary" });
  }
};

/**
 * GET /api/v1/admin/notifications
 *
 * Cached for 2 minutes — runs 6 MongoDB queries (2 distinct + 4 count).
 * Previously re-ran every time any admin opened the panel.
 */
const NOTIF_CACHE_TTL = 600; // 10 minutes — badge counts, admin-only, staleness is fine
let _notifMemCache = null;
let _notifMemCacheAt = 0;

export const getNotificationCounts = async (req, res) => {
  // Only cache when no timestamp filters are active (i.e. the standard sidebar badge poll)
  const canCache = !req.query.lastViewedOrders && !req.query.lastViewedReturns;
  const CACHE_KEY = 'admin:notif:counts';

  if (canCache) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });
    } catch (_) {
      if (_notifMemCache && (Date.now() - _notifMemCacheAt) < NOTIF_CACHE_TTL * 1000) {
        return res.json({ success: true, data: _notifMemCache, cached: true });
      }
    }
  }

  try {
    const { lastViewedOrders, lastViewedReturns } = req.query;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // To count users requiring attention, we find users with failed orders or open tickets directly.
    // Tickets reference their owner as `userId`, not `user` — distinct("user") returned [] and
    // silently dropped every open ticket from this badge.
    const [usersWithFailedOrders, usersWithOpenTickets] = await Promise.all([
      Order.distinct("user", { paymentStatus: "failed" }),
      Ticket.distinct("userId", { status: "open" })
    ]);

    const usersReqAttentionSet = new Set([
      ...usersWithFailedOrders.map(id => id.toString()),
      ...usersWithOpenTickets.map(id => id.toString())
    ]);

    const usersCount = usersReqAttentionSet.size;

    // Same exclusion as the orders list, so the badge never counts orders the list hides.
    const ordersQuery = { orderStatus: "pending", $nor: [unpaidOnlineCheckoutFilter()] };
    if (lastViewedOrders && !isNaN(Number(lastViewedOrders))) {
      ordersQuery.createdAt = { $gt: new Date(Number(lastViewedOrders)) };
    }

    const returnsQuery = { orderStatus: "return_requested" };
    if (lastViewedReturns && !isNaN(Number(lastViewedReturns))) {
      returnsQuery.updatedAt = { $gt: new Date(Number(lastViewedReturns)) };
    }

    const [tickets, logs, orders, returns] = await Promise.all([
      Ticket.countDocuments({ status: "open" }),
      AuditLogV2.countDocuments({ 
        event_type: "PAYMENT_FAILED", 
        timestamp_utc: { $gte: sevenDaysAgo } 
      }),
      Order.countDocuments(ordersQuery),
      Order.countDocuments(returnsQuery)
    ]);

    const payload = { tickets, users: usersCount, logs, orders, returns };

    if (canCache) {
      try {
        await redis.setex(CACHE_KEY, NOTIF_CACHE_TTL, JSON.stringify(payload));
      } catch (_) {
        _notifMemCache = payload;
        _notifMemCacheAt = Date.now();
      }
    }

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error("Notification Counts Error:", err);
    res.status(500).json({ success: false, message: "Error fetching notification counts" });
  }
};

/**
 * GET /api/v1/admin/dashboard/recent-orders
 */
export const getRecentOrders = async (req, res) => {
  try {
    const limit = req.pagination?.limit ?? 5; // Fallback if middleware is skipped
    
    const orders = await Order.find({
      orderStatus: { $ne: "abandoned" },
      $nor: [unpaidOnlineCheckoutFilter()]  // same rows as the orders list
    })
      .populate("user", "name email")
      .populate("items.product", "name pid images price")
      .select("user items totalAmount orderStatus paymentStatus paymentMethod createdAt shippingDetails.name shippingDetails.email")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: orders
    });
  } catch (err) {
    console.error("Recent Orders Error:", err);
    res.status(500).json({ success: false, message: "Error fetching recent orders" });
  }
};

/**
 * GET /api/v1/admin/products
 */
export const getAllProductsAdmin = async (req, res) => {
  try {
    const { limit, skip } = req.pagination;
    const { search, category, isActive } = req.query;

    const query = {};
    if (search) {
      const safeSearch = escapeStringRegexp(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { pid: { $regex: safeSearch, $options: "i" } }
      ];
    }
    if (category) query.category = category;
    if (isActive === "true" || isActive === "false") {
      query.isActive = isActive === "true";
    }

    // Exclude embedded reviews array — it can be hundreds of KB per product.
    // Admin product list only needs card-level fields; reviews are fetched on the individual product page.
    const ADMIN_PRODUCT_LIST_FIELDS = '-reviews';

    const [products, total] = await Promise.all([
      Product.find(query).select(ADMIN_PRODUCT_LIST_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: products,
      total,
      page: req.pagination.page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("Admin GetAllProducts Error:", err);
    res.status(500).json({ success: false, message: "Error fetching products" });
  }
};

/**
 * GET /api/v1/admin/products/:id  (Mongo _id or pid)
 *
 * The product editor used to load through the public GET /products/:pid. That route
 * only returns ACTIVE products, so hidden products couldn't be edited at all, and its
 * projection omits admin-only fields (price_inr, lowStockThreshold, availability,
 * is_active_based). The form then saved its defaults over them: every edit reset
 * price_inr to 0 (which the chat assistant quotes to customers) and the low-stock
 * threshold to 5.
 */
export const getProductAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = mongoose.isObjectIdOrHexString(id) ? { _id: id } : { pid: id };
    const product = await Product.findOne(filter).select("-reviews").lean();
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, data: product });
  } catch (err) {
    console.error("Admin GetProduct Error:", err);
    res.status(500).json({ success: false, message: "Error fetching product" });
  }
};

/**
 * Product fields the admin editor may write. One list for create and update — they were
 * two hand-copied lists, and a field missing from a list is dropped silently (200, no
 * error, nothing saved). `google_product_category` was missing from both, so the
 * editor's Merchant Center category dropdown never saved. `pid` is passed as a
 * create-only extra: storefront URLs and the product feed are keyed on it.
 */
const PRODUCT_EDITABLE_FIELDS = [
  "name", "price", "price_inr", "description", "images", "stock", "lowStockThreshold",
  "category", "sub_category", "product_type", "item_form", "texture", "google_product_category",
  "brand", "ingredients", "benefits", "concerns_targeted", "how_to_use", "tips", "warnings",
  "usage", "skin_type_suitable", "skin_type_not_suitable", "hair_type_suitable",
  "product_weight_g", "product_weight_ml", "availability", "is_active_based",
  "slug", "isActive", "seo_keywords", "variants",
  "seo_title", "seo_description", "seo_h1", "seo_h2", "seo_image_alt", "faqs",
];
const pickProductFields = (body, extra = []) => Object.fromEntries(
  [...PRODUCT_EDITABLE_FIELDS, ...extra]
    .filter((key) => body?.[key] !== undefined)
    .map((key) => [key, body[key]])
);

/**
 * POST /api/v1/admin/products
 */
export const createProductAdmin = async (req, res) => {
  try {
    // pid is create-only — it was missing here, so every new product failed with
    // "pid is required" no matter what the form sent.
    const allowedFields = pickProductFields(req.body, ["pid"]);

    const product = new Product(allowedFields);
    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error("Admin CreateProduct Error:", err);
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "pid";
      return res.status(409).json({ success: false, message: `A product with this ${field} already exists.` });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/v1/admin/products/:id
 */
export const updateProductAdmin = async (req, res) => {
  try {
    // Allowlist editable fields — never let the client overwrite sensitive computed/control fields
    const allowedFields = pickProductFields(req.body);

    // Needed to record stock changes below; also the 404 check.
    const before = await Product.findById(req.params.id).select("stock").lean();
    if (!before) return res.status(404).json({ success: false, message: "Product not found" });

    // CRITICAL: always use $set — passing a plain object to findByIdAndUpdate
    // without $set causes Mongoose to do a full document REPLACEMENT, wiping
    // any fields not present in req.body (e.g. reviews, rating, ratingCount).
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: allowedFields },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // The stock-history drawer is built from STOCK_* audit events. Bulk import and
    // return restocks logged one; inline and form edits didn't, so the history the
    // drawer showed silently omitted every manual adjustment.
    if (allowedFields.stock !== undefined && Number(before.stock) !== Number(product.stock)) {
      await logAuditEvent({
        event_type: "STOCK_MANUAL_EDIT",
        user_id: req.user._id,
        severity: "INFO",
        source_system: "backend-api",
        correlation_id: product._id.toString(),
        network: { ip_address: req.ip },
        metadata: {
          targetType: "product",
          targetId: product._id.toString(),
          before: { stock: before.stock },
          after: { stock: product.stock },
          reason: "manual_edit"
        }
      }).catch(err => console.error("Stock edit audit failed:", err.message));
    }

    res.json({ success: true, data: product });
  } catch (err) {
    console.error("Admin UpdateProduct Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};


/**
 * PATCH /api/v1/admin/products/:id/status
 */
export const toggleProductStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive } }, // $set required — plain object replaces the whole doc
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, data: product });
  } catch (err) {
    console.error("Admin ToggleStatus Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};


/**
 * GET /api/v1/admin/products/low-stock
 */
export const getLowStockProducts = async (req, res) => {
  try {
    // Only the fields the analytics dashboard actually renders — strip reviews.
    const LOW_STOCK_FIELDS = 'pid name stock lowStockThreshold category images price isActive';
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ["$stock", "$lowStockThreshold"] }
    }).select(LOW_STOCK_FIELDS).sort({ stock: 1 }).limit(100);

    res.json({ success: true, data: products });
  } catch (err) {
    console.error("Admin LowStock Error:", err);
    res.status(500).json({ success: false, message: "Error fetching low stock products" });
  }
};

/**
 * PATCH /api/v1/admin/products/bulk-status
 */
export const bulkUpdateProductStatus = async (req, res) => {
  try {
    const { ids, isActive } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ success: false, message: "IDs must be an array" });

    await Product.updateMany(
      { _id: { $in: ids } },
      { $set: { isActive } }
    );

    res.json({ success: true, message: `Updated ${ids.length} products` });
  } catch (err) {
    console.error("Admin BulkUpdate Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/orders
 */
// Per-order last-sync timestamps — in-process cache, reset on redeploy.
// Keeps us from hammering Shiprocket API every time an admin refreshes the orders list.
const shiprocketSyncCache = new Map(); // orderId (string) → last synced timestamp (ms)
const SR_SYNC_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes per order
const SR_SYNC_MAX_PER_CALL = 10; // never more than 10 Shiprocket calls per admin page load

/**
 * Shiprocket `orders/show` statuses → ours. Shiprocket spells it "CANCELED" (one L);
 * a map with only "cancelled" never matched a courier-side cancellation.
 */
const SHIPROCKET_STATUS_MAP = {
  "new":              "pending",
  "awb assigned":     "processing",
  "label generated":  "processing",
  "manifested":       "processing",
  "pickup scheduled": "processing",
  "pickup generated": "processing",
  "pickup queued":    "processing",
  "out for pickup":   "processing",
  "ready to ship":    "processing",
  "picked up":        "shipped",
  "shipped":          "shipped",
  "in transit":       "shipped",
  "out for delivery": "shipped",
  "delivered":        "delivered",
  "cancelled":        "cancelled",
  "canceled":         "cancelled",
  "rto initiated":    "returned",
  "rto in transit":   "returned",
  "rto delivered":    "returned",
};
const FORWARD_STATUSES = ["pending", "processing", "shipped", "delivered"];

/**
 * Build the update that brings `order` in line with a Shiprocket `orders/show`
 * payload, or null when nothing changed. Shared by the list auto-sync and the
 * per-order Sync button so the two can't drift apart again.
 *
 * Field names are the ones a live `orders/show` response actually carries: there is
 * no top-level `awb_code`, `courier_name` or `etd`. The AWB is `awb_data.awb` /
 * `shipments.awb`, the courier `shipments.courier` / `last_mile_courier_name`, the
 * EDD `etd_date`. Reading the wrong names meant the Sync button never picked up an
 * AWB and neither sync ever filled in the courier or delivery estimate.
 *
 * Only forward movement from a forward status is applied. Comparing positions in
 * FORWARD_STATUSES without that guard gave cancelled/return_requested orders an index
 * of -1, so any Shiprocket status counted as "forward" — an order with an approved
 * return was flipped back to "delivered" because its outbound shipment still shows
 * DELIVERED.
 *
 * A courier-side cancellation or RTO is NOT applied silently. Moving the order to
 * cancelled/returned here would skip the refund and stock restore the admin status
 * flow performs (see applyAdminStatusChange); the order is flagged for manual review
 * instead, and ops cancel it from the panel, which does both.
 */
const buildShiprocketSyncUpdate = (order, srOrder, { changedBy = null, notePrefix = "Synced from Shiprocket" } = {}) => {
  if (!srOrder) return null;
  const set = {};
  let historyEntry = null;

  const awb = srOrder.awb_data?.awb || srOrder.shipments?.awb;
  if (!order.awb && awb) set.awb = awb;

  const courier = srOrder.shipments?.courier || srOrder.last_mile_courier_name;
  if (courier && courier !== order.estimatedCourierName) set.estimatedCourierName = courier;

  const etdRaw = srOrder.etd_date || srOrder.etd;
  if (etdRaw) {
    const edd = new Date(etdRaw);
    const current = order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).getTime() : null;
    if (!isNaN(edd.getTime()) && edd.getTime() !== current) set.estimatedDeliveryDate = edd;
  }

  const mapped = SHIPROCKET_STATUS_MAP[(srOrder.status || "").toLowerCase()];
  const currentIdx = FORWARD_STATUSES.indexOf(order.orderStatus);

  if (mapped && currentIdx !== -1 && FORWARD_STATUSES.indexOf(mapped) > currentIdx) {
    set.orderStatus = mapped;
    // Same stamps the Shiprocket webhook writes — deliveredAt drives the return window.
    if ((mapped === "shipped" || mapped === "delivered") && !order.shippedAt) set.shippedAt = new Date();
    if (mapped === "delivered") {
      if (!order.deliveredAt) set.deliveredAt = new Date();
      if (order.paymentMethod === "cod" && order.paymentStatus !== "paid") set.paymentStatus = "paid";
    }
    historyEntry = {
      fromStatus: order.orderStatus,
      toStatus: mapped,
      status: mapped,
      changedBy,
      // Must be a statusHistory.source enum value. Updates skip validators, so an invalid
      // one (this used to write "shiprocket_auto_sync") persists and then makes every
      // later order.save() — admin status changes, returns — fail validation.
      source: "shiprocket",
      note: `${notePrefix}: "${srOrder.status}"`,
      changedAt: new Date(),
    };
  } else if ((mapped === "cancelled" || mapped === "returned") && !["cancelled", "returned"].includes(order.orderStatus)) {
    const reason = `Shiprocket reports this order as "${srOrder.status}". Cancel or return it from the admin panel so the refund and stock restore run.`;
    const existing = order.reviewReason || "";
    if (!order.needsManualReview || !existing.includes(reason)) {
      set.needsManualReview = true;
      set.reviewReason = order.needsManualReview && existing ? `${existing} | ${reason}` : reason;
    }
  }

  if (Object.keys(set).length === 0 && !historyEntry) return null;
  const update = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (historyEntry) update.$push = { statusHistory: historyEntry };
  return update;
};

const autoSyncOrdersWithShiprocket = async (orders) => {
  if (!process.env.SHIPROCKET_EMAIL) return;

  const now = Date.now();

  // Only sync orders that are active AND haven't been synced in the last 30 minutes
  const staleOrders = orders.filter((o) => {
    if (!o.shiprocketOrderId) return false;
    if (!["pending", "processing", "shipped", "return_requested"].includes(o.orderStatus)) return false;
    const lastSync = shiprocketSyncCache.get(o._id.toString());
    return !lastSync || (now - lastSync) > SR_SYNC_COOLDOWN_MS;
  }).slice(0, SR_SYNC_MAX_PER_CALL); // hard cap

  if (staleOrders.length === 0) return;

  try {
    const token = await getShiprocketToken();
    const syncPromises = staleOrders.map(async (order) => {
      // Mark as synced immediately to prevent concurrent duplicate calls
      shiprocketSyncCache.set(order._id.toString(), now);
      try {
        const detailRes = await fetch(
          `https://apiv2.shiprocket.in/v1/external/orders/show/${order.shiprocketOrderId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!detailRes.ok) return;

        const detailData = await detailRes.json();
        const update = buildShiprocketSyncUpdate(order, detailData?.data, {
          notePrefix: "Auto-synced from Shiprocket",
        });
        if (update) await Order.findByIdAndUpdate(order._id, update);
      } catch (err) {
        console.error(`Auto-sync failed for order ${order._id}:`, err.message);
      }
    });

    await Promise.all(syncPromises);
  } catch (err) {
    console.error("Auto Sync Token Error:", err.message);
  }
};


/**
 * GET /api/v1/admin/orders
 */
export const getAllOrdersAdmin = async (req, res) => {
  try {
    const { limit, skip } = req.pagination;
    const { search, orderStatus, paymentStatus, startDate, endDate } = req.query;

    // Only real orders: paid online orders, COD orders and admin drafts. Unpaid online
    // checkouts (cancelled or failed payments) are hidden from the moment they're
    // created; once 30 minutes old they appear in the Abandoned Checkouts section.
    const query = {
      orderStatus: { $ne: "abandoned" },   // set by the cleanup cron
      $nor: [unpaidOnlineCheckoutFilter()]
    };

    if (search) {
      const term = String(search).trim();
      const safeSearch = escapeStringRegexp(term);
      // Built conditionally: an `{ _id: undefined }` entry (the old non-ObjectId case)
      // is cast to `{}`, which matches every order — searching by name, email or phone
      // returned the entire list.
      const or = [
        { "shippingDetails.email": { $regex: safeSearch, $options: "i" } },
        { "shippingDetails.phone": { $regex: safeSearch, $options: "i" } },
        { "shippingDetails.name": { $regex: safeSearch, $options: "i" } }
      ];
      if (mongoose.isObjectIdOrHexString(term)) or.push({ _id: term });
      // The admin UI shows orders as "#" + the last 8 hex chars of the id, so that's
      // what people paste into search. Match it as an id suffix.
      const shortId = term.replace(/^#/, "");
      if (/^[0-9a-f]{6,23}$/i.test(shortId)) {
        or.push({ $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: `${shortId}$`, options: "i" } } });
      }
      query.$or = or;
    }
    if (orderStatus) query.orderStatus = orderStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = parseRangeStart(startDate);
        if (isNaN(start.getTime())) return res.status(400).json({ success: false, message: "Invalid startDate" });
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = parseRangeEnd(endDate);
        if (isNaN(end.getTime())) return res.status(400).json({ success: false, message: "Invalid endDate" });
        query.createdAt.$lte = end;
      }
    }

    // Slim product populate — the admin orders list only needs image+name for the thumbnail.
    // Returning full product docs (with reviews) inflates each order document enormously.
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("user", "name email")
        .populate("items.product", "name pid images price")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query)
    ]);

    // Auto-sync active orders before returning (fire and forget to prevent blocking response)
    autoSyncOrdersWithShiprocket(orders).catch(console.error);

    res.json({
      success: true,
      data: orders,
      total,
      page: req.pagination.page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("Admin GetAllOrders Error:", err);
    res.status(500).json({ success: false, message: "Error fetching orders" });
  }
};

/**
 * GET /api/v1/admin/orders/:id
 */
export const getOrderByIdAdmin = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email phone role")
      .populate("items.product", "name pid price images")
      .populate("statusHistory.changedBy", "name"); // timeline shows "by <admin>"

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.json({ success: true, data: order });
  } catch (err) {
    console.error("Admin GetOrder Error:", err);
    res.status(500).json({ success: false, message: "Error fetching order details" });
  }
};

/**
 * ORDER STATUS TRANSITION MAP
 * Valid transitions per the plan.
 */
const ORDER_TRANSITIONS = {
  pending:           ["processing", "cancelled"],
  processing:        ["shipped", "cancelled"],
  shipped:           ["delivered", "return_requested"],
  delivered:         ["return_requested"],
  cancelled:         [],
  return_requested:  ["returned", "shipped"], // shipped = return rejected, go back
  returned:          []
};

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

/**
 * Apply an admin-initiated status change to a hydrated order, including every side
 * effect the target status needs. Mutates `order` but does not save it.
 *
 * The single-order and bulk endpoints both go through here. They used to diverge:
 * only the single-order endpoint refunded, restocked and cancelled on Shiprocket, and
 * the admin UI only ever calls the bulk one — so every admin cancellation of a paid
 * order went out with no refund and no stock restore.
 *
 * Returns { ok: false, reason } for a disallowed transition, otherwise
 * { ok: true, warnings } where warnings are side effects that failed and need a human
 * (a refund that didn't go through, a Shiprocket shipment that's still live).
 */
export const applyAdminStatusChange = async (order, newStatus, req, { note } = {}) => {
  const currentStatus = order.orderStatus;
  const allowed = ORDER_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return {
      ok: false,
      reason: `Cannot transition order from "${currentStatus}" to "${newStatus}". Allowed: [${allowed.join(", ") || "none"}]`
    };
  }

  const warnings = [];
  const shortId = order._id.toString().slice(-8).toUpperCase();

  order.statusHistory.push({
    fromStatus: currentStatus,
    toStatus: newStatus,
    status: newStatus,
    changedBy: req.user._id,
    source: "admin",
    note: note || `Status updated to ${newStatus} by admin`
  });
  order.orderStatus = newStatus;

  // Same stamps the Shiprocket webhook sets. Without deliveredAt the return window
  // fell back to updatedAt, which moves on every later edit (so it never closed), and
  // a COD order marked delivered here stayed "payment pending" forever.
  if ((newStatus === "shipped" || newStatus === "delivered") && !order.shippedAt) order.shippedAt = new Date();
  if (newStatus === "delivered") {
    if (!order.deliveredAt) order.deliveredAt = new Date();
    if (order.paymentMethod === "cod" && order.paymentStatus === "pending") order.paymentStatus = "paid";
  }

  // ── Cancelled: pull the shipment from Shiprocket ──
  if (newStatus === "cancelled" && (order.awb || order.shiprocketOrderId) && process.env.SHIPROCKET_EMAIL) {
    try {
      const token = await getShiprocketToken();
      const srRes = order.awb
        ? await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel/awbs", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ awbs: [order.awb] })
          })
        : await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: [order.shiprocketOrderId] })
          });
      if (!srRes.ok) throw new Error(`Shiprocket responded ${srRes.status}`);
    } catch (err) {
      console.error("Admin cancel: Failed to cancel on Shiprocket:", err.message);
      warnings.push(`#${shortId}: Shiprocket cancellation failed (${err.message}) — cancel the shipment in Shiprocket manually.`);
    }
  }

  if (newStatus === "cancelled" || newStatus === "returned") {
    // ── Refund the captured payment ──
    const alreadyRefunding = ["pending", "processed"].includes(order.refundStatus);
    if (order.paymentStatus === "paid" && order.razorpayPaymentId && !alreadyRefunding) {
      try {
        const Razorpay = (await import("razorpay")).default;
        const razorpayInstance = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        // Full refund of whatever is still captured — no explicit amount, which would
        // fail outright if it exceeded the captured amount (rounding, or a prior
        // partial refund).
        const refund = await razorpayInstance.payments.refund(order.razorpayPaymentId, {
          speed: "normal",
          notes: { reason: `Order ${newStatus} by admin` },
        });
        order.refundId = refund.id;
        order.refundStatus = "pending";
        order.refundAmount = refund?.amount != null
          ? fromRazorpayMinorUnits(refund.amount, (refund.currency || order.currency || "INR").toUpperCase())
          : order.totalAmount;
        order.paymentStatus = "refunded";
      } catch (refundErr) {
        const msg = refundErr?.error?.description || refundErr.message || "unknown error";
        console.error("Admin cancel: Razorpay refund failed:", msg);
        order.refundStatus = "failed";
        order.refundAmount = order.totalAmount;
        // Persisted, so the failure stays visible ("Needs review") after the toast is gone.
        order.needsManualReview = true;
        order.reviewReason = `Refund failed on ${newStatus === "returned" ? "return" : "cancellation"} (${msg}) — refund the customer manually in Razorpay.`;
        warnings.push(`#${shortId}: Razorpay refund failed (${msg}) — refund the customer manually.`);
      }
    } else if (order.paymentStatus === "paid" && !order.razorpayPaymentId && order.paymentMethod !== "cod") {
      warnings.push(`#${shortId}: marked paid but has no Razorpay payment to refund — refund the customer manually.`);
    }

    // ── Restore stock ──
    // Every order-creation path (storefront COD, Razorpay checkout, admin draft)
    // deducts stock up front, so stock is owed back whenever it hasn't been restored
    // yet — paid or not. The old "only if paid or COD" rule leaked the stock of every
    // unpaid order an admin cancelled. Claimed atomically: the draft-cleanup cron and
    // the payment webhooks restore stock too, and must not double-count with this.
    if (order.items?.length && !order.isStockRestored) {
      const claimed = await Order.findOneAndUpdate(
        { _id: order._id, isStockRestored: { $ne: true } },
        { $set: { isStockRestored: true } }
      );
      if (claimed) {
        try {
          await Product.bulkWrite(order.items.map(item => ({
            updateOne: { filter: { _id: item.product }, update: { $inc: { stock: item.quantity } } },
          })));
        } catch (stockErr) {
          console.error("Admin cancel: Failed to restore stock:", stockErr.message);
          warnings.push(`#${shortId}: stock restore failed — adjust inventory manually.`);
        }
      }
      order.isStockRestored = true;
    }

    // ── Release the welcome offer ──
    // The customer cancel flow, the abandon cron and the returns flow all hand the
    // offer back when the order it was spent on doesn't go through; an admin
    // cancellation kept it consumed.
    if (order.isWelcomeOfferApplied) {
      const userHasPaidOrder = await Order.exists({
        user: order.user,
        orderStatus: { $nin: ["abandoned", "cancelled", "returned"] },
        _id: { $ne: order._id },
        $or: [{ paymentMethod: "cod" }, { paymentStatus: { $in: ["paid", "refunded"] } }]
      });
      if (!userHasPaidOrder) {
        await UserProfile.updateOne({ _id: order.user }, { $set: { welcomeOfferUsed: false } });
      }
    }

    // A cancelled order never went through — hand its coupon slot back.
    if (newStatus === "cancelled") {
      await releaseCouponUsage(order._id).catch(err => console.error("Coupon release failed:", err.message));
    }
  }

  await logAction(req, "order_status_update", "order", order._id.toString(), {
    before: { status: currentStatus },
    after: { status: newStatus },
    meta: { source: "admin", note }
  });

  return { ok: true, warnings };
};

/**
 * PATCH /api/v1/admin/orders/:id/status
 */
export const updateOrderStatusAdmin = async (req, res) => {
  try {
    const { orderStatus, paymentStatus, note } = req.body;
    if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: `Invalid paymentStatus "${paymentStatus}"` });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Applied first so "mark paid + cancel" in one request refunds, as before.
    if (paymentStatus && order.paymentStatus !== "refunded") {
      order.paymentStatus = paymentStatus;
    }

    let warnings = [];
    if (orderStatus) {
      const result = await applyAdminStatusChange(order, orderStatus, req, { note });
      if (!result.ok) return res.status(400).json({ success: false, message: result.reason });
      warnings = result.warnings;
    }

    await order.save();

    // Invalidate users cache since orders affect user stats/flags
    await redis.incr("admin:users:version");

    res.json({ success: true, data: order, warnings });
  } catch (err) {
    console.error("Admin UpdateOrderStatus Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/users
 */
export const getAllUsersAdmin = async (req, res) => {
  try {
    const { limit, skip } = req.pagination;
    const { search, role, isBlocked, segment } = req.query;

    const query = {};
    if (search) {
      const safeSearch = escapeStringRegexp(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } }
      ];
    }
    if (role && role !== "") query.role = role;
    if (isBlocked === "true" || isBlocked === "false") {
      query.isBlocked = isBlocked === "true";
    }
    if (segment && segment !== "") query.segment = segment;

    const version = (await redis.get("admin:users:version")) || "0";
    const cacheKey = `admin:users:v${version}:${JSON.stringify(query)}:${skip}:${limit}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "user",
          // Project only the 3 fields consumed by $addFields — prevents full order docs
          // from crossing the Atlas→Render wire just to be discarded post-join.
          pipeline: [
            { $project: { orderStatus: 1, paymentStatus: 1, paymentMethod: 1, totalAmount: 1, currency: 1 } }
          ],
          as: "userOrders"
        }
      },
      {
        // Tickets reference their owner as `userId`. Joining on `user` matched nothing,
        // so hasOpenQuery was always false and open-ticket customers never surfaced.
        $lookup: {
          from: "tickets",
          let: { userId: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ["$userId", "$$userId"] }, { $eq: ["$status", "open"] } ] } } },
            { $limit: 1 }
          ],
          as: "openTickets"
        }
      },
      {
        // A real order: not dead (cancelled/returned/abandoned) and actually paid for,
        // or COD. "pending" alone also matches unpaid online checkouts.
        $addFields: {
          realOrders: {
            $filter: {
              input: "$userOrders",
              as: "o",
              cond: {
                $and: [
                  { $in: ["$$o.orderStatus", ["pending", "processing", "shipped", "delivered"]] },
                  { $or: [{ $eq: ["$$o.paymentStatus", "paid"] }, { $eq: ["$$o.paymentMethod", "cod"] }] }
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          totalOrders: { $size: "$realOrders" },
          // The list renders this as ₹ — only INR orders can be summed into it.
          totalRevenue: {
            $sum: {
              $map: {
                input: "$realOrders",
                as: "o",
                in: { $cond: [{ $eq: [{ $ifNull: ["$$o.currency", "INR"] }, "INR"] }, "$$o.totalAmount", 0] }
              }
            }
          },
          hasPaymentFailure: {
            $in: ["failed", "$userOrders.paymentStatus"]
          },
          hasOpenQuery: { $gt: [{ $size: "$openTickets" }, 0] }
        }
      },
      { $project: { userOrders: 0, realOrders: 0, openTickets: 0 } },
      {
        $sort: {
          hasOpenQuery: -1,
          hasPaymentFailure: -1,
          createdAt: -1
        }
      },
      { $skip: skip },
      { $limit: limit }
    ];

    const [users, total] = await Promise.all([
      UserProfile.aggregate(pipeline),
      UserProfile.countDocuments(query)
    ]);

    const responseData = {
      success: true,
      data: users,
      total,
      page: req.pagination.page,
      pages: Math.ceil(total / limit)
    };

    await redis.setex(cacheKey, 180, JSON.stringify(responseData));

    res.json(responseData);
  } catch (err) {
    console.error("Admin GetAllUsers Error:", err);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
};

/**
 * PATCH /api/v1/admin/users/:id/block
 */
export const toggleUserBlock = async (req, res) => {
  try {
    const { isBlocked } = req.body;
    const targetId = req.params.id;

    if (typeof isBlocked !== "boolean") {
      return res.status(400).json({ success: false, message: "isBlocked must be true or false" });
    }

    // Safety: Prevent self-blocking
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot block yourself" });
    }

    const target = await UserProfile.findById(targetId).select("role isBlocked");
    if (!target) return res.status(404).json({ success: false, message: "User not found" });

    // Blocked users are rejected by `protect`, so blocking is a lockout. Any admin could
    // previously lock out the Primary Admin or another admin through this route — the
    // same hierarchy updateUserRole enforces has to apply here.
    if (target.role === "primary_admin") {
      return res.status(403).json({ success: false, message: "The Primary Admin cannot be blocked." });
    }
    if (target.role === "admin" && req.user.role !== "primary_admin") {
      return res.status(403).json({ success: false, message: "Only the Primary Admin can block another admin." });
    }

    const previous = target.isBlocked;
    const user = await UserProfile.findByIdAndUpdate(targetId, { $set: { isBlocked } }, { new: true });
    clearAuthCache(); // a block must take effect on the user's very next request

    await logAction(req, isBlocked ? "USER_BLOCKED" : "USER_UNBLOCKED", "user", targetId, {
      before: { isBlocked: previous },
      after: { isBlocked },
    });
    // The users list is cached per version — without this it showed the old state for 3 minutes.
    await redis.incr("admin:users:version");

    res.json({ success: true, data: user });
  } catch (err) {
    console.error("Admin ToggleBlock Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/v1/admin/users/:id/role
 */
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const targetId = req.params.id;

    // Only user <-> admin transitions via API. primary_admin can only be set via seed script / DB.
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Allowed values: 'user', 'admin'."
      });
    }

    // Safety: Prevent self-demotion
    if (targetId === req.user._id.toString() && role === "user") {
      return res.status(400).json({ success: false, message: "You cannot demote yourself" });
    }

    const targetUser = await UserProfile.findById(targetId);
    if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });

    // Prevent modifying another primary_admin
    if (targetUser.role === "primary_admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot change the role of a Primary Admin via the panel."
      });
    }

    // Safety: Prevent removing the last admin (count both admin types)
    if (role === "user" && targetUser.role === "admin") {
      const adminCount = await UserProfile.countDocuments({ role: { $in: ["admin", "primary_admin"] } });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: "Cannot remove the last administrator" });
      }
    }

    const previousRole = targetUser.role;
    targetUser.role = role;
    clearAuthCache(); // role changes take effect immediately
    await targetUser.save();

    await logAction(
      req,
      role === "admin" ? "PROMOTE_USER" : "DEMOTE_USER",
      "user",
      targetId,
      {
        before: { role: previousRole },
        after: { role },
        meta: { source: "admin" }
      }
    );
    // The users list is cached per version — without this it showed the old role for 3 minutes.
    await redis.incr("admin:users:version");

    res.json({ success: true, data: targetUser });
  } catch (err) {
    console.error("Admin UpdateRole Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/logs
 */
export const getLogsAdmin = async (req, res) => {
  try {
    const { limit, skip } = req.pagination;
    const { event_type, severity, is_anomaly, search, startDate, endDate } = req.query;

    const query = {};
    if (event_type) query.event_type = event_type;
    if (severity) query.severity = severity;
    if (is_anomaly !== undefined) query['flags.is_anomaly'] = is_anomaly === 'true';

    if (startDate || endDate) {
      query.timestamp_utc = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.valueOf())) query.timestamp_utc.$gte = d;
      }
      if (endDate) {
        const d = new Date(endDate);
        if (!isNaN(d.valueOf())) {
          d.setUTCHours(23, 59, 59, 999); // include entire end day
          query.timestamp_utc.$lte = d;
        }
      }
      if (Object.keys(query.timestamp_utc).length === 0) delete query.timestamp_utc;
    }

    if (search) {
      // The search box promises "events, IDs, or users" — it only matched the two id
      // fields, so typing an event name or a person's name always returned nothing.
      const re = new RegExp(escapeStringRegexp(String(search).trim()), "i");
      const matchingUsers = await UserProfile.find({ $or: [{ name: re }, { email: re }] })
        .select("_id").limit(100).lean();
      query.$or = [
        { correlation_id: re },
        { session_id: re },
        { event_type: re },
        ...(matchingUsers.length ? [{ user_id: { $in: matchingUsers.map(u => u._id) } }] : [])
      ];
    }

    const logs = await AuditLogV2.find(query)
      .populate("user_id", "name email")
      .sort({ timestamp_utc: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await AuditLogV2.countDocuments(query);

    res.json({ 
      success: true, 
      data: logs,
      total,
      page: req.pagination.page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("Admin GetLogs Error:", err);
    res.status(500).json({ success: false, message: "Error fetching audit logs" });
  }
};

/**
 * GET /api/v1/admin/logs/export
 */
export const exportLogsCSV = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const exportQuery = {};
    if (startDate || endDate) {
      exportQuery.timestamp_utc = {};
      if (startDate) exportQuery.timestamp_utc.$gte = new Date(startDate);
      if (endDate) {
        const d = new Date(endDate);
        d.setUTCHours(23, 59, 59, 999);
        exportQuery.timestamp_utc.$lte = d;
      }
    }

    const logs = await AuditLogV2.find(exportQuery)
      .populate("user_id", "name email")
      .sort({ timestamp_utc: -1 })
      .limit(5000)
      .lean();

    const sanitizeCsv = (val) => {
      if (typeof val !== "string") val = String(val || "");
      if (val.match(/^[=\+\-@]/)) return "'" + val;
      return val;
    };

    let csv = "Timestamp,Level,Type,User,CorrelationID,Message,IP\n";
    logs.forEach(l => {
      const ts = new Date(l.timestamp_utc).toISOString();
      const level = sanitizeCsv(l.severity);
      const type = sanitizeCsv(l.event_type);
      const userName = l.user_id?.name || l.user_id?.email || "System";
      // Quoted: a name containing a comma shifted every later column.
      const user = `"${sanitizeCsv(userName).replace(/"/g, '""')}"`;
      const corrId = sanitizeCsv(l.correlation_id || "None");
      const rawMsg = l.metadata?.reason || l.metadata?.error || l.metadata?.action || "";
      const msg = `"${sanitizeCsv(rawMsg).replace(/"/g, '""')}"`;
      const ip = sanitizeCsv(l.network?.ip_address || "Unknown");

      csv += `${ts},${level},${type},${user},${corrId},${msg},${ip}\n`;
    });

    res.header("Content-Type", "text/csv");
    res.attachment("audit_logs_export.csv");
    return res.send(csv);
  } catch (err) {
    console.error("Admin ExportLogs Error:", err);
    res.status(500).json({ success: false, message: "Error exporting audit logs" });
  }
};

/**
 * GET /api/v1/admin/orders/export
 */
export const exportOrdersCSV = async (req, res) => {
  try {
    const { startDate, endDate, orderStatus, paymentStatus } = req.query;
    // Exclude unpaid checkouts just like the main view
    const exportQuery = {
      orderStatus: { $ne: "abandoned" },
      $nor: [unpaidOnlineCheckoutFilter()]   // keep the CSV consistent with the on-screen list
    };
    // The same status filters the list applies, so "Export" saves what's on screen.
    if (orderStatus) exportQuery.orderStatus = orderStatus;
    if (paymentStatus) exportQuery.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      exportQuery.createdAt = {};
      if (startDate) exportQuery.createdAt.$gte = parseRangeStart(startDate);
      if (endDate) exportQuery.createdAt.$lte = parseRangeEnd(endDate);
    }

    // Hard cap at 5000 rows — prevents loading the full orders collection into memory
    // on every export click. Select only the fields written to the CSV.
    const orders = await Order.find(exportQuery)
      .sort({ createdAt: -1 })
      .limit(5000)
      .select('_id createdAt shippingDetails totalAmount currency paymentMethod paymentStatus orderStatus awb')
      .lean();

    const sanitizeCsv = (val) => {
      if (typeof val !== "string") val = String(val || "");
      if (val.match(/^[=\+\-@]/)) return "'" + val;
      return val;
    };

    // Currency column: totals are in the order's own currency, and without it a $40
    // order read as ₹40 in the spreadsheet.
    let csv = "Order ID,Date,Customer Name,Email,Phone,Total,Currency,Payment Method,Payment Status,Order Status,AWB\n";
    orders.forEach(o => {
      const date = new Date(o.createdAt).toISOString().split("T")[0];
      const name = `"${sanitizeCsv(o.shippingDetails?.name || "").replace(/"/g, '""')}"`;
      const email = `"${sanitizeCsv(o.shippingDetails?.email || "").replace(/"/g, '""')}"`;
      const phone = sanitizeCsv(o.shippingDetails?.phone || "");
      const total = o.totalAmount;
      const currency = sanitizeCsv(o.currency || "INR");
      const paymentMethod = sanitizeCsv(o.paymentMethod || "N/A");
      const paymentStatus = sanitizeCsv(o.paymentStatus || "N/A");
      const orderStatus = sanitizeCsv(o.orderStatus || "N/A");
      const awb = sanitizeCsv(o.awb || "N/A");
      csv += `${o._id},${date},${name},${email},${phone},${total},${currency},${paymentMethod},${paymentStatus},${orderStatus},${awb}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=orders.csv`);
    res.status(200).send(csv);
  } catch (err) {
    console.error("Admin ExportOrders Error:", err);
    res.status(500).json({ success: false, message: "Error exporting orders" });
  }
};

/**
 * PATCH /api/v1/admin/orders/bulk-status
 */
export const bulkUpdateOrderStatus = async (req, res) => {
  try {
    const { ids, orderStatus, note } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids must be a non-empty array" });
    }
    if (!orderStatus) {
      return res.status(400).json({ success: false, message: "orderStatus is required" });
    }

    const updated = [];
    const failed = [];
    const warnings = [];

    const orders = await Order.find({ _id: { $in: ids } });
    if (orders.length === 0) return res.status(404).json({ success: false, message: "No orders found" });

    // Same routine as the single-order endpoint, so a bulk cancel refunds, restocks
    // and cancels on Shiprocket exactly like a single one. Each order is isolated: one
    // that fails no longer aborts the loop half-way with the rest silently unprocessed.
    for (const order of orders) {
      try {
        const result = await applyAdminStatusChange(order, orderStatus, req, {
          note: note || `Bulk status update to ${orderStatus}`
        });
        if (!result.ok) {
          failed.push({ id: order._id, reason: result.reason });
          continue;
        }
        await order.save();
        updated.push(order._id);
        warnings.push(...result.warnings);
      } catch (err) {
        console.error(`Admin BulkOrderStatus: order ${order._id} failed:`, err.message);
        failed.push({ id: order._id, reason: err.message });
      }
    }

    if (updated.length > 0) {
      await logAction(req, "bulk_order_status_update", "order", "multiple", {
        after: { status: orderStatus },
        meta: { count: updated.length, source: "admin" }
      });
      // Invalidate users cache since orders affect user stats/flags
      await redis.incr("admin:users:version");
    }

    res.json({ success: true, updated: updated.length, failed, warnings });
  } catch (err) {
    console.error("Admin BulkOrderStatus Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/users/:id/orders
 * Customer Purchase History Drawer
 */
export const getCustomerOrderHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [customer, orders, total] = await Promise.all([
      UserProfile.findById(id, "name email createdAt"),
      Order.find({ user: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("items.product", "name pid images price")
        .lean(),
      Order.countDocuments({ user: id })
    ]);

    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    // Build summary aggregation
    const [summary] = await Order.aggregate([
      { $match: { user: customer._id } },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
          firstOrderAt: { $min: "$createdAt" },
          lastOrderAt: { $max: "$createdAt" }
        }
      }
    ]);

    // Frequency series: orders per month
    const frequencySeries = await Order.aggregate([
      { $match: { user: customer._id } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Avg days between orders
    let avgDaysBetweenOrders = 0;
    if (summary && summary.orderCount > 1) {
      const totalDays = (new Date(summary.lastOrderAt) - new Date(summary.firstOrderAt)) / (1000 * 60 * 60 * 24);
      avgDaysBetweenOrders = Math.round(totalDays / (summary.orderCount - 1));
    }

    res.json({
      success: true,
      data: {
        customer: { id: customer._id, name: customer.name, email: customer.email },
        summary: {
          totalSpend: summary?.totalSpend || 0,
          orderCount: summary?.orderCount || 0,
          firstOrderAt: summary?.firstOrderAt || null,
          lastOrderAt: summary?.lastOrderAt || null,
          avgDaysBetweenOrders
        },
        orders,
        frequencySeries,
        pagination: { page, pages: Math.ceil(total / limit), total }
      }
    });
  } catch (err) {
    console.error("Admin CustomerHistory Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/products/:id/stock-history
 * Returns normalized stock series + edit log
 */
export const getProductStockHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id, "name pid stock");
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // Fetch all stock-related audit logs for this product, 30-day window
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await AuditLogV2.find({
      $or: [
        { "metadata.targetType": "product", "metadata.targetId": id },
        { "metadata.targetType": "product", "metadata.targetId": product._id.toString() }
      ],
      event_type: { $regex: /^STOCK/i },
      timestamp_utc: { $gte: thirtyDaysAgo }
    })
      .populate("user_id", "name")
      .sort({ timestamp_utc: 1 })
      .lean();

    // Build normalized edits list
    const edits = logs.map(log => ({
      timestamp: log.timestamp_utc,
      actorName: log.user_id?.name || "System",
      from: log.metadata?.before?.stock ?? null,
      to: log.metadata?.after?.stock ?? null,
      reason: log.metadata?.reason || log.event_type
    }));

    // Build time series by carrying forward the last known stock value
    const seriesMap = {};
    let rollingStock = product.stock; // start from current

    // Walk backwards to reconstruct historical values
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp_utc) - new Date(b.timestamp_utc));
    if (sortedLogs.length > 0) {
      // Use the 'before' from the first log as our starting point
      rollingStock = sortedLogs[0].metadata?.before?.stock ?? product.stock;
      for (const log of sortedLogs) {
        const dateKey = new Date(log.timestamp_utc).toISOString().split("T")[0];
        rollingStock = log.metadata?.after?.stock ?? rollingStock;
        seriesMap[dateKey] = rollingStock;
      }
    }

    // Include today
    const todayKey = new Date().toISOString().split("T")[0];
    seriesMap[todayKey] = product.stock;

    const series = Object.entries(seriesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stock]) => ({ date, stock }));

    res.json({
      success: true,
      data: {
        productId: product._id,
        pid: product.pid,
        name: product.name,
        currentStock: product.stock,
        series,
        edits
      }
    });
  } catch (err) {
    console.error("Admin StockHistory Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/admin/products/bulk-stock
 * CSV stock import: replace semantics, row-level validation, dry-run support
 */
export const bulkStockImport = async (req, res) => {
  try {
    const { rows, dryRun = false } = req.body;
    // rows = [ { pid, stock } ]

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: "rows must be a non-empty array" });
    }

    const results = { total: rows.length, updated: 0, failed: 0, errors: [] };

    // Validate and collect updates
    const updates = [];
    const seenPids = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Duplicate check
      if (seenPids.has(row.pid)) {
        results.failed++;
        results.errors.push({ row: rowNum, pid: row.pid, reason: "Duplicate PID in import" });
        continue;
      }
      seenPids.add(row.pid);

      // Validate stock — whole numbers only. parseInt accepted "12abc" as 12 and "1.5" as 1.
      const stock = /^\s*\d+\s*$/.test(String(row.stock ?? "")) ? Number(row.stock) : NaN;
      if (!Number.isSafeInteger(stock) || stock < 0) {
        results.failed++;
        results.errors.push({ row: rowNum, pid: row.pid, reason: `Invalid stock value: "${row.stock}"` });
        continue;
      }

      // Validate pid exists
      const product = await Product.findOne({ pid: row.pid }, "_id pid stock");
      if (!product) {
        results.failed++;
        results.errors.push({ row: rowNum, pid: row.pid, reason: "Product not found" });
        continue;
      }

      updates.push({ product, newStock: stock, rowNum });
    }

    if (!dryRun) {
      for (const { product, newStock } of updates) {
        const prevStock = product.stock;
        await Product.findByIdAndUpdate(product._id, { stock: newStock });

        await logAuditEvent({
          event_type: "STOCK_BULK_IMPORT",
          user_id: req.user._id,
          severity: "INFO",
          source_system: "backend-api",
          correlation_id: product._id.toString(),
          network: { ip_address: req.ip },
          metadata: {
            targetType: "product",
            targetId: product._id.toString(),
            before: { stock: prevStock },
            after: { stock: newStock },
            reason: "bulk_import"
          }
        });

        results.updated++;
      }
    } else {
      results.updated = updates.length;
    }

    res.json({
      success: true,
      dryRun,
      ...results,
      preview: dryRun ? updates.map(u => ({ pid: u.product.pid, from: u.product.stock, to: u.newStock })) : undefined
    });
  } catch (err) {
    console.error("Admin BulkStockImport Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/admin/upload
 * Handle image upload for product images.
 */
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ success: false, message: "Cloudinary keys missing from .env" });
    }

    // Configure Cloudinary inline
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET 
    });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filename = `BD-NEW-${uniqueSuffix}-${safeOriginalName}`;

    // Wrap upload_stream in a Promise to ensure serverless environments wait for completion
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          folder: MEDIA_FOLDER,
          public_id: filename // Optional: force the exact public_id you want
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(new Error("Failed to upload to Cloudinary"));
          } else {
            resolve(result);
          }
        }
      );
      // End the stream with the buffer
      stream.end(req.file.buffer);
    });

    res.status(200).json({
      success: true,
      filename: uploadResult.public_id,
      path: uploadResult.secure_url
    });

  } catch (err) {
    console.error("Admin UploadImage Error:", err.message || err);
    res.status(500).json({ success: false, message: err.message || "Failed to upload image" });
  }
};

/**
 * POST /api/v1/admin/orders/:id/push-shiprocket
 * Manually push an order to Shiprocket (e.g. for orders that missed auto-push).
 */
export const adminPushShiprocket = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product", ORDER_ITEM_PRODUCT_FIELDS);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.shiprocketOrderId) {
      return res.status(400).json({
        success: false,
        message: `Order already pushed to Shiprocket (ID: ${order.shiprocketOrderId})`,
      });
    }

    const cancellable = ["pending", "processing"];
    if (!cancellable.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot push order in "${order.orderStatus}" status to Shiprocket`,
      });
    }

    // An unpaid online order is a checkout in progress (or an admin draft whose link
    // hasn't been paid). Nothing downstream checks payment, so pushing one shipped goods
    // that were never paid for.
    if (order.paymentMethod !== "cod" && order.paymentStatus !== "paid") {
      return res.status(400).json({
        success: false,
        message: `Cannot ship an unpaid order (payment status: ${order.paymentStatus}).`,
      });
    }

    // manual: true — an admin explicitly pushing this one order is the human
    // confirmation the international auto-push gate exists to require, so this
    // call must not be silently no-op'd by that same gate.
    // srPush updates order in DB internally (saves shipmentId, shiprocketOrderId, awb)
    await srPush(order, { manual: true });

    // Re-fetch to return the updated doc
    const updated = await Order.findById(order._id)
      .populate("user", "name email")
      .populate("items.product", "name pid price images");

    // srPush swallows its own errors (Shiprocket API failure, missing credentials,
    // etc.) and just flags the order for manual review instead of throwing — so
    // "no shiprocketOrderId after the call" is the only reliable signal that it
    // didn't actually work. Without this check the endpoint always returned 200
    // even when nothing was pushed, and the admin UI showed a false "Pushed ✓".
    if (!updated.shiprocketOrderId) {
      return res.status(502).json({
        success: false,
        message: updated.reviewReason || "Shiprocket did not return an order ID. Check server logs for details.",
      });
    }

    await logAction(req, "ADMIN_PUSH_SHIPROCKET", "order", order._id.toString(), {
      shiprocketOrderId: updated.shiprocketOrderId,
      awb: updated.awb,
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Admin PushShiprocket Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/admin/orders/:id/sync-shiprocket
 * Re-fetch AWB + tracking status from Shiprocket and sync back to our DB.
 */
export const adminSyncShiprocket = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (!order.shiprocketOrderId) {
      return res.status(400).json({
        success: false,
        message: "Order has not been pushed to Shiprocket yet",
      });
    }

    if (!process.env.SHIPROCKET_EMAIL) {
      return res.status(500).json({ success: false, message: "Shiprocket credentials not configured" });
    }

    const token = await getShiprocketToken();

    // Fetch order details from Shiprocket
    const detailRes = await fetch(
      `https://apiv2.shiprocket.in/v1/external/orders/show/${order.shiprocketOrderId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!detailRes.ok) {
      const errText = await detailRes.text();
      return res.status(502).json({ success: false, message: `Shiprocket error: ${errText}` });
    }

    const detailData = await detailRes.json();
    const srOrder = detailData?.data;
    const update = buildShiprocketSyncUpdate(order, srOrder, { changedBy: req.user._id });

    if (!update) {
      const populated = await Order.findById(order._id)
        .populate("user", "name email")
        .populate("items.product", "name pid price images");
      return res.json({ success: true, message: "Already up to date", data: populated });
    }

    await Order.findByIdAndUpdate(order._id, update);

    const populated = await Order.findById(order._id)
      .populate("user", "name email")
      .populate("items.product", "name pid price images");

    await logAction(req, "ADMIN_SYNC_SHIPROCKET", "order", order._id.toString(), {
      synced: update.$set || {},
    });

    const flagged = Boolean(update.$set?.needsManualReview);
    return res.json({
      success: true,
      message: flagged
        ? `Shiprocket shows this order as "${srOrder?.status}" — flagged for review. Cancel it here to refund and restock.`
        : undefined,
      data: populated,
    });
  } catch (err) {
    console.error("Admin SyncShiprocket Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/abandoned-checkouts
 */
export const getAbandonedCheckouts = async (req, res) => {
  try {
    const { limit, skip } = req.pagination;
    const query = abandonedCheckoutFilter();

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: orders,
      total,
      page: req.pagination.page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("Admin AbandonedCheckouts Error:", err);
    res.status(500).json({ success: false, message: "Error fetching abandoned checkouts" });
  }
};

/**
 * POST /api/v1/admin/draft-orders
 * Create a draft order manually (B2B, phone orders). Locks inventory.
 */
export const createDraftOrder = async (req, res) => {
  let { userId, items, shippingDetails, manualDiscount = 0, notes, paymentMethod = "razorpay", paymentStatus = "pending" } = req.body;

  // ── Validate before opening a transaction (early returns used to leak it) ──
  if (!Array.isArray(items) || items.length === 0 || !shippingDetails?.address) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }
  if (!userId && (!shippingDetails.name || !shippingDetails.email)) {
    return res.status(400).json({ success: false, message: "Name and Email are required for Guest Orders" });
  }
  // The draft form sent "cash_on_delivery", which isn't an Order.paymentMethod value,
  // so every COD draft failed schema validation.
  if (paymentMethod === "cash_on_delivery") paymentMethod = "cod";
  if (!["cod", "razorpay"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: `Unsupported payment method "${paymentMethod}"` });
  }
  // "Mark as Already Paid" was ignored (status was hardcoded to pending): the order was
  // saved as an unpaid Razorpay checkout, swept to "abandoned" by the cleanup cron with
  // its stock released, and vanished from the orders list.
  if (!["pending", "paid"].includes(paymentStatus)) {
    return res.status(400).json({ success: false, message: `Invalid payment status "${paymentStatus}"` });
  }
  // A negative quantity matched `stock >= qty` and then INCREASED stock while
  // subtracting from the total; fractions and zero aren't orderable either.
  if (items.some(item => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
    return res.status(400).json({ success: false, message: "Every item needs a whole-number quantity of at least 1" });
  }
  manualDiscount = Number(manualDiscount);
  if (!Number.isFinite(manualDiscount) || manualDiscount < 0) {
    return res.status(400).json({ success: false, message: "Discount must be zero or a positive amount" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 🚀 Support Guest Orders
    if (!userId) {
      // Check if this email already exists
      let existingUser = await UserProfile.findOne({ email: shippingDetails.email }).session(session);
      
      if (existingUser) {
        userId = existingUser._id;
      } else {
        // Create a guest user profile
        const [newUser] = await UserProfile.create([{
          firebaseUID: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: shippingDetails.name,
          email: shippingDetails.email,
          phone: shippingDetails.phone || "",
          addresses: [{
            name: shippingDetails.name,
            phone: shippingDetails.phone || "",
            addressLine: shippingDetails.address,
            city: shippingDetails.city,
            state: shippingDetails.state,
            pincode: shippingDetails.pincode,
            country: shippingDetails.country || "India"
          }]
        }], { session });
        userId = newUser._id;
      }
    }

    let totalAmount = 0;
    const orderItems = [];

    // Calculate prices and lock inventory
    for (const item of items) {
      const qty = Number(item.quantity); // validated above as an integer >= 1
      let productMatch = null;
      if (mongoose.Types.ObjectId.isValid(item.productId)) {
        productMatch = { _id: item.productId };
      } else {
        productMatch = { pid: item.pid || item.productId };
      }

      const product = await Product.findOneAndUpdate(
        { ...productMatch, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true, session }
      );

      if (!product) {
        // Determine if it didn't exist or just didn't have stock
        const exists = await Product.findOne(productMatch).session(session);
        if (!exists) throw new Error(`Product ${item.productId} not found`);
        throw new Error(`Insufficient stock for ${exists.name}`);
      }

      totalAmount += product.price * qty;

      orderItems.push({
        product: product._id,
        quantity: qty,
        priceAtPurchase: product.price
      });
    }

    const settings = await StoreSettings.findOne().session(session) || {
      shippingThreshold: 999, shippingCost: 99,
      internationalShippingThreshold: 10000, internationalShippingCost: 2000,
    };
    // International addresses were charged the domestic rate (₹99 for a parcel that
    // costs ~₹2000 to send abroad). Static international rate here — the live
    // Shiprocket quote is a network call that doesn't belong inside the transaction;
    // the admin can adjust with the manual discount.
    const isIndia = ["india", "in", "bharat", "ind"].includes(String(shippingDetails.country || "India").toLowerCase().trim());
    const shippingCost = isIndia
      ? (totalAmount >= settings.shippingThreshold ? 0 : settings.shippingCost)
      : (totalAmount >= settings.internationalShippingThreshold ? 0 : settings.internationalShippingCost);
    const originalAmount = totalAmount + shippingCost;
    if (manualDiscount > originalAmount) {
      throw new Error(`Discount (₹${manualDiscount}) can't exceed the order total (₹${originalAmount})`);
    }
    const finalAmount = originalAmount - manualDiscount;

    const [newOrder] = await Order.create([{
      user: userId,
      items: orderItems,
      totalAmount: finalAmount,
      originalAmount,
      // Was never stored, so the order showed shipping as "Free" while charging it.
      shippingCost,
      // GST contained in the total (domestic only), as on storefront orders.
      taxAmount: calculateInclusiveTax(finalAmount, isIndia ? (settings.taxRatePercent || 0) : 0),
      discountAmount: manualDiscount,
      paymentMethod,
      paymentStatus,
      orderStatus: paymentStatus === "paid" ? "processing" : "pending",
      shippingDetails,
      source: "admin_draft",
      // The schema field is `adminNote`; a bare `notes` key is silently discarded,
      // so the admin's note never reached the database.
      adminNote: notes || "",
    }], { session });

    await UserProfile.findByIdAndUpdate(userId, { $push: { orders: newOrder._id } }, { session });

    // Audit Log
    await logAction(req, "DRAFT_ORDER_CREATED", "order", newOrder._id.toString(), {
      totalAmount: finalAmount,
      notes
    }, { session });

    await session.commitTransaction();
    session.endSession();

    const populatedOrder = await Order.findById(newOrder._id)
      .populate("user", "name email")
      .populate("items.product", "name pid price images");

    res.status(201).json({ success: true, data: populatedOrder });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    console.error("Admin CreateDraftOrder Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

import HomepageContent from "../settings/homepageModel.js";

export const getImages = async (req, res) => {
  try {
    const { nextCursor, maxResults = 30 } = req.query;
    
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET 
    });

    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: `${MEDIA_FOLDER}/`,
      max_results: Math.min(Number(maxResults) || 30, 500),
      next_cursor: nextCursor,
      direction: 'desc'
    });

    const images = result.resources.map(res => ({
      publicId: res.public_id,
      url: res.secure_url,
      width: res.width,
      height: res.height,
      format: res.format,
      bytes: res.bytes,
      createdAt: res.created_at,
      tags: res.tags || []
    }));

    res.json({
      success: true,
      images,
      nextCursor: result.next_cursor || null
    });
  } catch (err) {
    console.error("GetImages Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch images" });
  }
};

export const deleteImages = async (req, res) => {
  try {
    const { publicIds } = req.body;
    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      return res.status(400).json({ success: false, message: "No publicIds provided" });
    }

    const invalidIds = publicIds.filter(id => {
      try {
        const decoded = decodeURIComponent(id);
        const normalized = path.normalize(decoded).replace(/\\/g, '/');
        return normalized.includes('..') || !normalized.startsWith(`${MEDIA_FOLDER}/`);
      } catch (e) {
        return true;
      }
    });

    if (invalidIds.length > 0) {
      return res.status(403).json({ success: false, message: "Invalid or unauthorized image path detected" });
    }

    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET 
    });

    const result = await cloudinary.api.delete_resources(publicIds, { invalidate: true });
    
    if (req.user) {
      await logAction(req, "IMAGES_DELETED", "settings", "media_library", { publicIds });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("DeleteImages Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete images" });
  }
};

export const getImageUsage = async (req, res) => {
  try {
    const { publicId } = req.query;
    if (!publicId) return res.status(400).json({ success: false, message: "publicId is required" });

    // Escaped for the Mongo regex only. The homepage check below is a plain substring
    // match, and the escaped form ("-" → "\x2d") never occurs in a real URL — images
    // used on the homepage reported as unused and could be deleted.
    const searchRegex = escapeStringRegexp(publicId);
    const searchString = publicId;

    // Warning: This does a full collection scan with a regex on every request
    const products = await Product.find({
      images: { $regex: searchRegex }
    }).select("pid name images isActive").lean();

    const usage = [];
    if (products.length > 0) {
      usage.push(...products.map(p => ({ type: 'Product', name: p.name, id: p._id })));
    }

    // Check Homepage Content
    const homepage = await HomepageContent.findOne();
    if (homepage) {
      const checkContent = (content, versionStr) => {
        if (!content) return;
        const slides = content.heroSlides || [];
        if (slides.some(s => s.imageUrl && s.imageUrl.includes(searchString))) {
          usage.push({ type: 'Homepage Slide', name: `Hero Carousel (${versionStr})` });
        }
        const categories = content.categories || [];
        if (categories.some(c => c.imageUrl && c.imageUrl.includes(searchString))) {
          usage.push({ type: 'Homepage Category', name: `Category Banner (${versionStr})` });
        }
      };
      checkContent(homepage.draft, 'Draft');
      checkContent(homepage.published, 'Published');
    }

    res.json({ success: true, usage });
  } catch (err) {
    console.error("GetImageUsage Error:", err);
    res.status(500).json({ success: false, message: "Failed to check image usage" });
  }
};
