import Order from "../tracker/models.js";
import UserProfile from "../profile/models.js";
import Product from "../products/models.js";
import { logAuditEvent } from "../audit/logger.js";
import { logAction } from "../admin/controller.js";
import { sendReturnApprovedEmail, sendReturnRejectedEmail } from "../email/emailService.js";

const AUTO_RESTOCK = process.env.AUTO_RESTOCK_ON_RECEIPT === "true";

/**
 * GET /api/v1/admin/returns
 * Paginated queue of orders with active return requests, oldest-first.
 */
export const getReturnsQueue = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, reason } = req.query;

    const query = { returnStatus: { $ne: "none" } };
    if (status) query.returnStatus = status;
    if (reason) query.returnReason = reason;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("user", "name email")
        .populate("items.product", "name pid images")
        .sort({ returnRequestedAt: 1 }) // oldest first
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("ReturnsQueue Error:", err);
    res.status(500).json({ success: false, message: "Error fetching returns queue" });
  }
};

/**
 * PATCH /api/v1/admin/returns/:id/approve
 * Approve a return. Requires refundMethod in body.
 */
export const approveReturn = async (req, res) => {
  try {
    const { refundMethod, note } = req.body;
    if (!refundMethod || !["original_payment", "store_credit", "replacement"].includes(refundMethod)) {
      return res.status(400).json({ success: false, message: "Valid refundMethod is required (original_payment | store_credit | replacement)" });
    }

    const order = await Order.findById(req.params.id).populate("user", "name email");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (!["requested"].includes(order.returnStatus)) {
      return res.status(400).json({ success: false, message: `Cannot approve a return with status "${order.returnStatus}"` });
    }

    order.returnStatus = "approved";
    order.returnRefundMethod = refundMethod;
    order.returnResolvedAt = new Date();
    order.orderStatus = "return_requested"; // keep consistent with order status
    if (note) order.adminNote = note;

    await order.save();

    // Fire approval email non-blocking
    const userEmail = order.shippingDetails?.email || order.user?.email;
    const userName = order.shippingDetails?.name || order.user?.name || "Customer";
    if (userEmail) {
      setImmediate(async () => {
        try { await sendReturnApprovedEmail(order, userEmail, userName); }
        catch (e) { console.error("Return approval email failed:", e.message); }
      });
    }

    await logAction(req, "return_approved", "order", order._id.toString(), {
      before: { returnStatus: "requested" },
      after: { returnStatus: "approved", refundMethod },
      meta: { source: "admin", note },
    });

    res.json({ success: true, data: order });
  } catch (err) {
    console.error("ApproveReturn Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/v1/admin/returns/:id/reject
 * Reject a return. Requires rejectionReason in body.
 */
export const rejectReturn = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ success: false, message: "rejectionReason is required and cannot be empty" });
    }

    const order = await Order.findById(req.params.id).populate("user", "name email");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (!["requested"].includes(order.returnStatus)) {
      return res.status(400).json({ success: false, message: `Cannot reject a return with status "${order.returnStatus}"` });
    }

    order.returnStatus = "rejected";
    order.returnResolvedAt = new Date();
    order.adminNote = rejectionReason;

    await order.save();

    // Fire rejection email non-blocking
    const userEmail = order.shippingDetails?.email || order.user?.email;
    const userName = order.shippingDetails?.name || order.user?.name || "Customer";
    if (userEmail) {
      setImmediate(async () => {
        try { await sendReturnRejectedEmail(order, userEmail, userName, rejectionReason); }
        catch (e) { console.error("Return rejection email failed:", e.message); }
      });
    }

    await logAction(req, "return_rejected", "order", order._id.toString(), {
      before: { returnStatus: "requested" },
      after: { returnStatus: "rejected" },
      meta: { source: "admin", rejectionReason },
    });

    res.json({ success: true, data: order });
  } catch (err) {
    console.error("RejectReturn Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/v1/admin/returns/:id/received
 * Mark physical item as received. Triggers optional restock.
 */
export const markReceived = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product", "name pid stock");

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.returnStatus !== "approved") {
      return res.status(400).json({ success: false, message: "Only approved returns can be marked as received" });
    }
    if (order.physicalReceived) {
      return res.status(400).json({ success: false, message: "Already marked as received" });
    }

    order.physicalReceived = true;
    order.returnStatus = "completed";

    // Optional restock
    const restockLog = [];
    if (AUTO_RESTOCK) {
      for (const item of order.items) {
        if (item.product?._id) {
          const newStock = (item.product.stock || 0) + (item.quantity || 1);
          await Product.findByIdAndUpdate(item.product._id, { stock: newStock });
          restockLog.push({ pid: item.product.pid, addedQty: item.quantity, newStock });

          await logAuditEvent({
            event_type: "STOCK_RESTOCK_ON_RETURN",
            user_id: req.user._id,
            severity: "INFO",
            source_system: "backend-api",
            correlation_id: item.product._id.toString(),
            network: { ip_address: req.ip },
            metadata: {
              targetType: "product",
              targetId: item.product._id.toString(),
              before: { stock: item.product.stock },
              after: { stock: newStock },
              reason: "return_received",
              source: "admin"
            }
          });
        }
      }
    }

    await order.save();

    await logAction(req, "return_marked_received", "order", order._id.toString(), {
      after: { physicalReceived: true, autoRestock: AUTO_RESTOCK },
      meta: { restockLog, source: "admin" },
    });

    res.json({ success: true, data: order, restockLog });
  } catch (err) {
    console.error("MarkReceived Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/returns/analytics
 * Return rate by product and category (30-day window), top-10 SKUs.
 */
export const getReturnAnalytics = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Return count per product
    const returnsByProduct = await Order.aggregate([
      { $match: { returnStatus: { $ne: "none" }, returnRequestedAt: { $gte: since } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          returnCount: { $sum: "$items.quantity" },
          topReason: { $first: "$returnReason" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          name: "$product.name",
          pid: "$product.pid",
          category: "$product.category",
          returnCount: 1,
          topReason: 1,
        },
      },
    ]);

    // Units sold per product in same window
    const soldByProduct = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          orderStatus: { $ne: "cancelled" },
          createdAt: { $gte: since },
        },
      },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", unitsSold: { $sum: "$items.quantity" } } },
    ]);

    const soldMap = {};
    soldByProduct.forEach((r) => { soldMap[r._id.toString()] = r.unitsSold; });

    const enriched = returnsByProduct
      .map((r) => {
        const unitsSold = soldMap[r._id.toString()] || 0;
        const returnRate = unitsSold > 0 ? ((r.returnCount / unitsSold) * 100).toFixed(1) : "0.0";
        return { ...r, unitsSold, returnRate: parseFloat(returnRate) };
      })
      .sort((a, b) => b.returnRate - a.returnRate);

    // Category-level rollup
    const byCategoryMap = {};
    enriched.forEach((r) => {
      if (!byCategoryMap[r.category]) byCategoryMap[r.category] = { returnCount: 0, unitsSold: 0 };
      byCategoryMap[r.category].returnCount += r.returnCount;
      byCategoryMap[r.category].unitsSold += r.unitsSold;
    });
    const byCategory = Object.entries(byCategoryMap).map(([category, v]) => ({
      category,
      returnCount: v.returnCount,
      unitsSold: v.unitsSold,
      returnRate: v.unitsSold > 0 ? parseFloat(((v.returnCount / v.unitsSold) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.returnRate - a.returnRate);

    res.json({
      success: true,
      data: {
        topSkus: enriched.slice(0, 10),
        byCategory,
        windowDays: days,
      },
    });
  } catch (err) {
    console.error("ReturnAnalytics Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
