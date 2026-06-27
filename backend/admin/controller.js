import Order from "../tracker/models.js";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";
import StoreSettings from "../settings/models.js";
import admin from "../config/firebaseAdmin.js";
import { v2 as cloudinary } from "cloudinary";
import AuditLogV2 from "../audit/models.js";
import { logAuditEvent } from "../audit/logger.js";
import mongoose from "mongoose";
import { pushOrderToShiprocket as srPush, getShiprocketToken } from "../tracker/shiprocketservice.js";
import Redis from "ioredis";
import { Ticket } from "../support/models.js";
import escapeStringRegexp from "escape-string-regexp";
import path from "path";



const redisUrl = process.env.REDIS_URL || null;
const redis = redisUrl ? new Redis(redisUrl) : {
  get: () => null,
  setex: () => {},
  del: () => {}
}; // Fallback if no redis url

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
 */
export const getDashboardSummary = async (req, res) => {
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
      // Total Orders
      Order.countDocuments({ orderStatus: { $ne: "cancelled" } }),
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

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        totalUsers,
        pendingShipments,
        lowStockCount,
        outOfStockCount,
        averageOrderValue: parseFloat(aov),
        recentActivity,
        categorySales
      }
    });
  } catch (err) {
    console.error("Dashboard Summary Error:", err);
    res.status(500).json({ success: false, message: "Error fetching dashboard summary" });
  }
};

/**
 * GET /api/v1/admin/notifications
 */
export const getNotificationCounts = async (req, res) => {
  try {
    const { lastViewedOrders, lastViewedReturns } = req.query;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // To count users requiring attention, we find users with failed orders or open tickets directly
    const [usersWithFailedOrders, usersWithOpenTickets] = await Promise.all([
      Order.distinct("user", { paymentStatus: "failed" }),
      Ticket.distinct("user", { status: "open" })
    ]);

    const usersReqAttentionSet = new Set([
      ...usersWithFailedOrders.map(id => id.toString()),
      ...usersWithOpenTickets.map(id => id.toString())
    ]);

    const usersCount = usersReqAttentionSet.size;

    const ordersQuery = { orderStatus: "pending" };
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

    res.json({
      success: true,
      data: {
        tickets,
        users: usersCount,
        logs,
        orders,
        returns
      }
    });
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
    
    const orders = await Order.find()
      .populate("user", "name email")
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

    const [products, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
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
 * POST /api/v1/admin/products
 */
export const createProductAdmin = async (req, res) => {
  try {
    const {
      name, price, price_inr, description, images, stock, lowStockThreshold,
      category, sub_category, product_type, item_form, texture,
      brand, ingredients, benefits, concerns_targeted, how_to_use, tips, warnings,
      usage, skin_type_suitable, skin_type_not_suitable, hair_type_suitable,
      product_weight_g, product_weight_ml, availability, is_active_based,
      slug, isActive,
    } = req.body;

    const allowedFields = Object.fromEntries(
      Object.entries({
        name, price, price_inr, description, images, stock, lowStockThreshold,
        category, sub_category, product_type, item_form, texture,
        brand, ingredients, benefits, concerns_targeted, how_to_use, tips, warnings,
        usage, skin_type_suitable, skin_type_not_suitable, hair_type_suitable,
        product_weight_g, product_weight_ml, availability, is_active_based,
        slug, isActive,
      }).filter(([, v]) => v !== undefined)
    );

    const product = new Product(allowedFields);
    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error("Admin CreateProduct Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/v1/admin/products/:id
 */
export const updateProductAdmin = async (req, res) => {
  try {
    // Allowlist editable fields — never let the client overwrite sensitive computed/control fields
    const {
      name, price, price_inr, description, images, stock, lowStockThreshold,
      category, sub_category, product_type, item_form, texture,
      brand, ingredients, benefits, concerns_targeted, how_to_use, tips, warnings,
      usage, skin_type_suitable, skin_type_not_suitable, hair_type_suitable,
      product_weight_g, product_weight_ml, availability, is_active_based,
      slug, isActive,
    } = req.body;

    const allowedFields = Object.fromEntries(
      Object.entries({
        name, price, price_inr, description, images, stock, lowStockThreshold,
        category, sub_category, product_type, item_form, texture,
        brand, ingredients, benefits, concerns_targeted, how_to_use, tips, warnings,
        usage, skin_type_suitable, skin_type_not_suitable, hair_type_suitable,
        product_weight_g, product_weight_ml, availability, is_active_based,
        slug, isActive,
      }).filter(([, v]) => v !== undefined)
    );

    // CRITICAL: always use $set — passing a plain object to findByIdAndUpdate
    // without $set causes Mongoose to do a full document REPLACEMENT, wiping
    // any fields not present in req.body (e.g. reviews, rating, ratingCount).
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: allowedFields },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
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
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ["$stock", "$lowStockThreshold"] }
    }).sort({ stock: 1 }).limit(100);

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
const autoSyncOrdersWithShiprocket = async (orders) => {
  if (!process.env.SHIPROCKET_EMAIL) return;
  const activeOrders = orders.filter(
    (o) =>
      o.shiprocketOrderId &&
      ["pending", "processing", "shipped", "return_requested"].includes(o.orderStatus)
  );

  if (activeOrders.length === 0) return;

  try {
    const token = await getShiprocketToken();
    const syncPromises = activeOrders.map(async (order) => {
      try {
        const detailRes = await fetch(
          `https://apiv2.shiprocket.in/v1/external/orders/show/${order.shiprocketOrderId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!detailRes.ok) return;

        const detailData = await detailRes.json();
        const srOrder = detailData?.data;
        if (!srOrder) return;

        const updates = {};
        const fetchedAwb = srOrder.awb_data?.awb || srOrder.shipments?.awb;
        if (!order.awb && fetchedAwb) updates.awb = fetchedAwb;
        if (srOrder.courier_name) updates.estimatedCourierName = srOrder.courier_name;
        if (srOrder.etd) {
          const edd = new Date(srOrder.etd);
          if (!isNaN(edd.getTime())) updates.estimatedDeliveryDate = edd;
        }

        const rawStatus = (srOrder.status || "").toLowerCase();
        const statusMap = {
          "new":              "pending",
          "ready to ship":    "processing",
          "in transit":       "shipped",
          "shipped":          "shipped",
          "out for delivery": "shipped",
          "delivered":        "delivered",
          "cancelled":        "cancelled",
          "rto initiated":    "returned",
          "rto delivered":    "returned",
        };
        const mappedStatus = statusMap[rawStatus];
        const statusPriority = ["pending", "processing", "shipped", "delivered"];
        
        if (
          mappedStatus &&
          (statusPriority.indexOf(mappedStatus) > statusPriority.indexOf(order.orderStatus) ||
           mappedStatus === "cancelled" || mappedStatus === "returned")
        ) {
          updates.orderStatus = mappedStatus;
          updates.$push = {
            statusHistory: {
              status: mappedStatus,
              changedBy: null,
              source: "shiprocket_auto_sync",
              note: `Auto-synced from Shiprocket: "${srOrder.status}"`,
              changedAt: new Date(),
            },
          };
        }

        const { $push, ...setFields } = updates;
        if (Object.keys(setFields).length > 0 || $push) {
          const updateOp = {};
          if (Object.keys(setFields).length > 0) updateOp.$set = setFields;
          if ($push) updateOp.$push = $push;
          await Order.findByIdAndUpdate(order._id, updateOp);
          
          Object.assign(order, setFields);
        }
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

    const query = {};
    if (search) {
      const safeSearch = escapeStringRegexp(search);
      query.$or = [
        { _id: mongoose.isValidObjectId(search) ? search : undefined },
        { "shippingDetails.email": { $regex: safeSearch, $options: "i" } },
        { "shippingDetails.phone": { $regex: safeSearch, $options: "i" } },
        { "shippingDetails.name": { $regex: safeSearch, $options: "i" } }
      ].filter(Boolean);
    }
    if (orderStatus) query.orderStatus = orderStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        if (isNaN(new Date(startDate).getTime())) return res.status(400).json({ success: false, message: "Invalid startDate" });
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        if (isNaN(new Date(endDate).getTime())) return res.status(400).json({ success: false, message: "Invalid endDate" });
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("user", "name email")
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
      .populate("items.product", "name pid price images");
    
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

/**
 * PATCH /api/v1/admin/orders/:id/status
 */
export const updateOrderStatusAdmin = async (req, res) => {
  try {
    const { orderStatus, paymentStatus, note, source = "admin" } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (orderStatus) {
      const currentStatus = order.orderStatus;
      const allowed = ORDER_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(orderStatus)) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition order from "${currentStatus}" to "${orderStatus}". Allowed: [${allowed.join(", ") || "none"}]`
        });
      }

      order.statusHistory.push({
        status: orderStatus,
        changedBy: req.user._id,
        source,
        note: note || `Status updated to ${orderStatus} by admin`
      });
      order.orderStatus = orderStatus;

      await logAction(req, "order_status_update", "order", order._id.toString(), {
        before: { status: currentStatus },
        after: { status: orderStatus },
        meta: { source, note }
      });

      // ── IF CANCELLED: trigger side effects (refund, shiprocket, stock) ──
      if (orderStatus === "cancelled") {
        // 1. Shiprocket Cancel
        if (order.awb || order.shiprocketOrderId) {
          try {
            if (process.env.SHIPROCKET_EMAIL) {
              const { getShiprocketToken } = await import("../tracker/shiprocketservice.js");
              const token = await getShiprocketToken();
              if (order.awb) {
                await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel/awbs", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ awbs: [order.awb] })
                });
              } else if (order.shiprocketOrderId) {
                await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ ids: [order.shiprocketOrderId] })
                });
              }
            }
          } catch (err) {
            console.error("Admin cancel: Failed to cancel on Shiprocket:", err.message);
          }
        }
      }

      // ── IF CANCELLED OR RETURNED: trigger refund and restore stock ──
      if (orderStatus === "cancelled" || orderStatus === "returned") {
        // 2. Razorpay Refund
        if ((order.paymentStatus === "paid" || paymentStatus === "paid") && order.razorpayPaymentId) {
          try {
            const Razorpay = (await import("razorpay")).default;
            const razorpayInstance = new Razorpay({
              key_id: process.env.RAZORPAY_KEY_ID,
              key_secret: process.env.RAZORPAY_KEY_SECRET,
            });
            const refund = await razorpayInstance.payments.refund(order.razorpayPaymentId, {
              amount: Math.round(order.totalAmount * 100),
              speed: "normal",
              notes: { reason: "Order cancelled by admin" },
            });
            order.refundId = refund.id;
            order.refundStatus = "pending";
            order.refundAmount = order.totalAmount;
            order.paymentStatus = "refunded";
          } catch (refundErr) {
            console.error("Admin cancel: Razorpay refund failed:", refundErr.message);
            order.refundStatus = "failed";
            order.refundAmount = order.totalAmount;
          }
        }

        // 3. Restore Stock (if paid or COD)
        const shouldRestoreStock = order.paymentMethod === "cod" || order.paymentStatus === "paid" || order.paymentStatus === "refunded" || paymentStatus === "paid";
        if (shouldRestoreStock && order.items && order.items.length > 0 && !order.isStockRestored) {
          try {
            const Product = (await import("../products/models.js")).default;
            const bulkOps = order.items.map(item => ({
              updateOne: { filter: { _id: item.product }, update: { $inc: { stock: item.quantity } } },
            }));
            await Product.bulkWrite(bulkOps);
            order.isStockRestored = true;
          } catch (stockErr) {
            console.error("Admin cancel: Failed to restore stock:", stockErr.message);
          }
        }
      }
    }
    
    if (paymentStatus && order.paymentStatus !== "refunded") {
      order.paymentStatus = paymentStatus;
    }

    await order.save();
    
    // Invalidate users cache since orders affect user stats/flags
    await redis.incr("admin:users:version");

    res.json({ success: true, data: order });
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
          as: "userOrders"
        }
      },
      {
        $lookup: {
          from: "tickets",
          localField: "_id",
          foreignField: "user",
          let: { userId: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ["$user", "$$userId"] }, { $eq: ["$status", "open"] } ] } } },
            { $limit: 1 }
          ],
          as: "openTickets"
        }
      },
      {
        $addFields: {
          totalOrders: {
            $size: {
              $filter: {
                input: "$userOrders",
                as: "o",
                cond: { $in: ["$$o.orderStatus", ["pending", "processing", "shipped", "delivered"]] }
              }
            }
          },
          totalRevenue: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$userOrders",
                    as: "o",
                    cond: { $in: ["$$o.orderStatus", ["pending", "processing", "shipped", "delivered"]] }
                  }
                },
                as: "o",
                in: "$$o.totalAmount"
              }
            }
          },
          hasPaymentFailure: {
            $in: ["failed", "$userOrders.paymentStatus"]
          },
          hasOpenQuery: { $gt: [{ $size: "$openTickets" }, 0] }
        }
      },
      { $project: { userOrders: 0, openTickets: 0 } },
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

    // Safety: Prevent self-blocking
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot block yourself" });
    }

    const user = await UserProfile.findByIdAndUpdate(targetId, { isBlocked }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

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
        if (!isNaN(d.valueOf())) query.timestamp_utc.$lte = d;
      }
      if (Object.keys(query.timestamp_utc).length === 0) delete query.timestamp_utc;
    }

    if (search) {
      const safeSearch = escapeStringRegexp(search);
      query.$or = [
        { correlation_id: new RegExp(safeSearch, "i") },
        { session_id: new RegExp(safeSearch, "i") }
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
    const logs = await AuditLogV2.find().sort({ timestamp: -1 }).limit(1000).lean();

    const sanitizeCsv = (val) => {
      if (typeof val !== "string") val = String(val || "");
      if (val.match(/^[=\+\-@]/)) return "'" + val;
      return val;
    };

    let csv = "Timestamp,Level,Type,User,Resource,Message,IP\n";
    logs.forEach(l => {
      const ts = new Date(l.timestamp).toISOString();
      const level = sanitizeCsv(l.severity);
      const type = sanitizeCsv(l.event_type);
      const user = sanitizeCsv(l.user_id || "System");
      const resource = sanitizeCsv(l.target_id || "None");
      const rawMsg = l.details?.reason || l.details?.error || l.details?.action || "";
      const msg = `"${sanitizeCsv(rawMsg).replace(/"/g, '""')}"`;
      const ip = sanitizeCsv(l.network?.ip_address || "Unknown");

      csv += `${ts},${level},${type},${user},${resource},${msg},${ip}\n`;
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
    const orders = await Order.find().sort({ createdAt: -1 }).lean();

    const sanitizeCsv = (val) => {
      if (typeof val !== "string") val = String(val || "");
      if (val.match(/^[=\+\-@]/)) return "'" + val;
      return val;
    };

    let csv = "Order ID,Date,Customer Name,Email,Phone,Total,Payment Method,Payment Status,Order Status,AWB\n";
    orders.forEach(o => {
      const date = new Date(o.createdAt).toISOString().split("T")[0];
      const name = `"${sanitizeCsv(o.shippingDetails?.name || "").replace(/"/g, '""')}"`;
      const email = `"${sanitizeCsv(o.shippingDetails?.email || "").replace(/"/g, '""')}"`;
      const phone = sanitizeCsv(o.shippingDetails?.phone || "");
      const total = o.totalAmount;
      const paymentMethod = sanitizeCsv(o.paymentMethod || "N/A");
      const paymentStatus = sanitizeCsv(o.paymentStatus || "N/A");
      const orderStatus = sanitizeCsv(o.orderStatus || "N/A");
      const awb = sanitizeCsv(o.awb || "N/A");
      csv += `${o._id},${date},${name},${email},${phone},${total},${paymentMethod},${paymentStatus},${orderStatus},${awb}\n`;
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
    const { ids, orderStatus, note, source = "admin" } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids must be a non-empty array" });
    }
    if (!orderStatus) {
      return res.status(400).json({ success: false, message: "orderStatus is required" });
    }

    const updated = [];
    const failed = [];

    const orders = await Order.find({ _id: { $in: ids } });
    if (orders.length === 0) return res.status(404).json({ success: false, message: "No orders found" });

    // Get allowed transitions from the map
    const ORDER_TRANSITIONS_MAP = {
      pending:          ["processing", "cancelled"],
      processing:       ["shipped", "cancelled"],
      shipped:          ["delivered", "return_requested"],
      delivered:        ["return_requested"],
      cancelled:        [],
      return_requested: ["returned", "shipped"],
      returned:         []
    };

    for (const order of orders) {
      const allowed = ORDER_TRANSITIONS_MAP[order.orderStatus] || [];
      if (!allowed.includes(orderStatus)) {
        failed.push({ id: order._id, reason: `Cannot transition from "${order.orderStatus}" to "${orderStatus}"` });
        continue;
      }
      order.statusHistory.push({
        status: orderStatus,
        changedBy: req.user._id,
        source,
        note: note || `Bulk status update to ${orderStatus}`
      });
      order.orderStatus = orderStatus;
      await order.save();
      updated.push(order._id);
    }

    if (updated.length > 0) {
      await logAction(req, "bulk_order_status_update", "order", "multiple", {
        after: { status: orderStatus },
        meta: { count: updated.length, source }
      });
      // Invalidate users cache since orders affect user stats/flags
      await redis.incr("admin:users:version");
    }

    res.json({ success: true, updated: updated.length, failed });
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

      // Validate stock
      const stock = parseInt(row.stock);
      if (isNaN(stock) || stock < 0) {
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
          folder: "bodilicious_products",
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
    const order = await Order.findById(req.params.id).populate("items.product");
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

    // srPush updates order in DB internally (saves shipmentId, shiprocketOrderId, awb)
    await srPush(order);

    // Re-fetch to return the updated doc
    const updated = await Order.findById(order._id)
      .populate("user", "name email")
      .populate("items.product", "name pid price images");

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

    const updates = {};

    // Sync AWB if we don't have it yet
    if (!order.awb && srOrder?.awb_code) updates.awb = srOrder.awb_code;

    // Sync courier name
    if (srOrder?.courier_name) updates.estimatedCourierName = srOrder.courier_name;

    // Sync estimated delivery date
    if (srOrder?.etd) {
      const edd = new Date(srOrder.etd);
      if (!isNaN(edd.getTime())) updates.estimatedDeliveryDate = edd;
    }

    // Map Shiprocket order status → internal status
    const rawStatus = (srOrder?.status || "").toLowerCase();
    const statusMap = {
      "new":              "pending",
      "ready to ship":    "processing",
      "in transit":       "shipped",
      "shipped":          "shipped",
      "out for delivery": "shipped",
      "delivered":        "delivered",
      "cancelled":        "cancelled",
      "rto initiated":    "returned",
      "rto delivered":    "returned",
    };
    const mappedStatus = statusMap[rawStatus];
    const statusPriority = ["pending", "processing", "shipped", "delivered"];
    if (
      mappedStatus &&
      (statusPriority.indexOf(mappedStatus) > statusPriority.indexOf(order.orderStatus) ||
       mappedStatus === "cancelled" || mappedStatus === "returned")
    ) {
      updates.orderStatus = mappedStatus;
      updates.$push = {
        statusHistory: {
          status: mappedStatus,
          changedBy: req.user._id,
          source: "shiprocket",
          note: `Synced from Shiprocket: "${srOrder?.status}"`,
          changedAt: new Date(),
        },
      };
    }

    const { $push, ...setFields } = updates;
    if (Object.keys(setFields).length === 0 && !$push) {
      const populated = await Order.findById(order._id)
        .populate("user", "name email")
        .populate("items.product", "name pid price images");
      return res.json({ success: true, message: "Already up to date", data: populated });
    }

    // Separate $push from the rest to avoid conflict
    const updateOp = {};
    if (Object.keys(setFields).length > 0) updateOp.$set = setFields;
    if ($push) updateOp.$push = $push;

    await Order.findByIdAndUpdate(order._id, updateOp);

    const populated = await Order.findById(order._id)
      .populate("user", "name email")
      .populate("items.product", "name pid price images");

    await logAction(req, "ADMIN_SYNC_SHIPROCKET", "order", order._id.toString(), {
      synced: setFields,
    });

    return res.json({ success: true, data: populated });
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
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    const query = {
      paymentStatus: { $in: ["pending", "failed"] },
      orderStatus: "pending",
      createdAt: { $lt: thirtyMinsAgo }
    };

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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let { userId, items, shippingDetails, manualDiscount = 0, notes, paymentMethod = "razorpay" } = req.body;
    const paymentStatus = "pending";

    if (!items || items.length === 0 || !shippingDetails?.address) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 🚀 Support Guest Orders
    if (!userId) {
      if (!shippingDetails.name || !shippingDetails.email) {
        return res.status(400).json({ success: false, message: "Name and Email are required for Guest Orders" });
      }
      
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
      let productMatch = null;
      if (mongoose.Types.ObjectId.isValid(item.productId)) {
        productMatch = { _id: item.productId };
      } else {
        productMatch = { pid: item.pid || item.productId };
      }

      const product = await Product.findOneAndUpdate(
        { ...productMatch, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true, session }
      );

      if (!product) {
        // Determine if it didn't exist or just didn't have stock
        const exists = await Product.findOne(productMatch).session(session);
        if (!exists) throw new Error(`Product ${item.productId} not found`);
        throw new Error(`Insufficient stock for ${exists.name}`);
      }

      totalAmount += product.price * item.quantity;
      
      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        priceAtPurchase: product.price
      });
    }

    const settings = await StoreSettings.findOne().session(session) || { shippingThreshold: 999, shippingCost: 99 };
    const shippingCost = totalAmount >= settings.shippingThreshold ? 0 : settings.shippingCost;
    const originalAmount = totalAmount + shippingCost;
    const finalAmount = Math.max(0, originalAmount - manualDiscount);

    const [newOrder] = await Order.create([{
      user: userId,
      items: orderItems,
      totalAmount: finalAmount,
      originalAmount,
      discountAmount: manualDiscount,
      paymentMethod,
      paymentStatus,
      orderStatus: paymentStatus === "paid" ? "processing" : "pending",
      shippingDetails,
      source: "admin_draft",
      notes
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

    const tenantFolder = "bodilicious_products";

    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: `${tenantFolder}/`,
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

    const tenantFolder = process.env.CLOUDINARY_FOLDER || "bodilicious";

    const invalidIds = publicIds.filter(id => {
      try {
        const decoded = decodeURIComponent(id);
        const normalized = path.normalize(decoded).replace(/\\/g, '/');
        return normalized.includes('..') || !normalized.startsWith(`${tenantFolder}/`);
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

    const searchString = escapeStringRegexp(publicId);
    
    // Warning: This does a full collection scan with a regex on every request
    const products = await Product.find({
      images: { $regex: searchString }
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
