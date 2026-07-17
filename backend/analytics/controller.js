import { DailySalesView, ProductVelocityView, CustomerCohortView, ProductIntelligenceView } from "./models.js";
import Product from "../products/models.js";
import Order from "../tracker/models.js";
import UserProfile from "../profile/models.js";
import AuditLogV2 from "../audit/models.js";
import { logAuditEvent } from "../audit/logger.js";

/**
 * Returns top level KPIs and charts
 * GET /api/v1/analytics/executive-summary
 */
export const getExecutiveSummary = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const limit = parseInt(req.query.days || "30", 10);
    
    const dailyData = await DailySalesView.find()
      .sort({ date_string: -1 })
      .limit(limit)
      .lean();

    dailyData.reverse();

    const totals = dailyData.reduce((acc, day) => {
      acc.revenue += day.net_revenue;
      acc.orders += day.order_count;
      return acc;
    }, { revenue: 0, orders: 0 });

    const aov = totals.orders > 0 ? totals.revenue / totals.orders : 0;

    res.json({
      success: true,
      data: {
        summary: {
          netRevenue: totals.revenue,
          orders: totals.orders,
          averageOrderValue: Math.round(aov)
        },
        chartData: dailyData
      }
    });
  } catch (error) {
    console.error("[Analytics] Error in getExecutiveSummary:", error);
    res.status(500).json({ success: false, message: "Failed to fetch analytics summary" });
  }
};

/**
 * Returns trending products based on velocity view
 * GET /api/v1/analytics/trending-products
 */
export const getTrendingProducts = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const limitDays = parseInt(req.query.days || "30", 10);
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - limitDays);
    const dateString = dateLimit.toISOString().split("T")[0];

    const pipeline = [
      { $match: { date_string: { $gte: dateString } } },
      {
        $group: {
          _id: "$product_id",
          totalPurchases: { $sum: "$purchases" },
          totalRevenue: { $sum: "$revenue_generated" },
        }
      },
      { $sort: { totalPurchases: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: 1,
          totalPurchases: 1,
          totalRevenue: 1,
          name: "$productDetails.name",
          images: "$productDetails.images",
          price: "$productDetails.price",
        }
      }
    ];

    const trending = await ProductVelocityView.aggregate(pipeline);
    res.json({ success: true, data: trending });
  } catch (error) {
    console.error("[Analytics] Error in getTrendingProducts:", error);
    res.status(500).json({ success: false, message: "Failed to fetch trending products" });
  }
};

/**
 * Returns product funnel data — views, carts, purchases, conversion rates
 * GET /api/v1/analytics/product-funnel
 */
export const getProductFunnel = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const limitDays = parseInt(req.query.days || "30", 10);
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - limitDays);
    const dateString = dateLimit.toISOString().split("T")[0];

    const pipeline = [
      { $match: { date_string: { $gte: dateString } } },
      {
        $group: {
          _id: "$product_id",
          totalViews: { $sum: "$views" },
          totalCarts: { $sum: "$carts" },
          totalPurchases: { $sum: "$purchases" },
          totalRevenue: { $sum: "$revenue_generated" },
        }
      },
      { $match: { $or: [{ totalViews: { $gt: 0 } }, { totalCarts: { $gt: 0 } }, { totalPurchases: { $gt: 0 } }] } },
      { $sort: { totalViews: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          totalViews: 1,
          totalCarts: 1,
          totalPurchases: 1,
          totalRevenue: 1,
          name: { $ifNull: ["$productDetails.name", "Unknown Product"] },
          images: { $ifNull: ["$productDetails.images", []] },
          viewToCartRate: {
            $cond: [
              { $gt: ["$totalViews", 0] },
              { $round: [{ $multiply: [{ $divide: ["$totalCarts", { $cond: [{ $eq: ["$totalViews", 0] }, 1, "$totalViews"] }] }, 100] }, 1] },
              0
            ]
          },
          cartToPurchaseRate: {
            $cond: [
              { $gt: ["$totalCarts", 0] },
              { $round: [{ $multiply: [{ $divide: ["$totalPurchases", { $cond: [{ $eq: ["$totalCarts", 0] }, 1, "$totalCarts"] }] }, 100] }, 1] },
              0
            ]
          },
          viewToPurchaseRate: {
            $cond: [
              { $gt: ["$totalViews", 0] },
              { $round: [{ $multiply: [{ $divide: ["$totalPurchases", { $cond: [{ $eq: ["$totalViews", 0] }, 1, "$totalViews"] }] }, 100] }, 1] },
              0
            ]
          },
        }
      }
    ];

    const funnel = await ProductVelocityView.aggregate(pipeline);

    const [overall] = await ProductVelocityView.aggregate([
      { $match: { date_string: { $gte: dateString } } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$views" },
          totalCarts: { $sum: "$carts" },
          totalPurchases: { $sum: "$purchases" },
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        products: funnel,
        overall: overall || { totalViews: 0, totalCarts: 0, totalPurchases: 0 }
      }
    });
  } catch (error) {
    console.error("[Analytics] Error in getProductFunnel:", error);
    res.status(500).json({ success: false, message: "Failed to fetch product funnel" });
  }
};

/**
 * Returns cohort retention data
 * GET /api/v1/analytics/cohorts
 */
export const getCohorts = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const cohorts = await CustomerCohortView.find()
      .sort({ cohort_month: -1, month_index: 1 })
      .lean();

    const cohortMap = new Map();

    cohorts.forEach(c => {
      if (!cohortMap.has(c.cohort_month)) {
        cohortMap.set(c.cohort_month, {
          cohort: c.cohort_month,
          total_users: c.total_users_in_cohort,
          months: []
        });
      }
      const cohortData = cohortMap.get(c.cohort_month);
      cohortData.months[c.month_index] = {
        active: c.active_users,
        retention_percent: c.total_users_in_cohort > 0 ? (c.active_users / c.total_users_in_cohort) * 100 : 0,
        revenue: c.revenue_retained
      };
    });

    res.json({ success: true, data: Array.from(cohortMap.values()) });
  } catch (error) {
    console.error("[Analytics] Error in getCohorts:", error);
    res.status(500).json({ success: false, message: "Failed to fetch cohorts" });
  }
};

/**
 * Returns low stock products (consolidated from insights into analytics)
 * GET /api/v1/analytics/low-stock
 */
export const getLowStock = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    })
      .select("pid name stock lowStockThreshold images")
      .sort({ stock: 1 })
      .lean();

    res.json({ success: true, data: products });
  } catch (error) {
    console.error("[Analytics] Error in getLowStock:", error);
    res.status(500).json({ success: false, message: "Failed to fetch low stock data" });
  }
};

/**
 * Lightweight event tracking — no auth required, works for guests
 * POST /api/v1/analytics/track
 * Body: { event: "product_viewed", productId: "...", productName: "..." }
 */
export const trackEvent = async (req, res) => {
  try {
    const { event, productId, productName } = req.body;

    const allowedEvents = ["product_viewed", "cart_item_added"];
    if (!event || !allowedEvents.includes(event)) {
      return res.status(400).json({ success: false, message: "Invalid event type" });
    }
    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required" });
    }

    // Map frontend event name to audit event_type (uppercase, consistent with logAction)
    const eventTypeMap = {
      product_viewed: "PRODUCT_VIEWED",
      cart_item_added: "CART_ITEM_ADDED",
    };

    await logAuditEvent({
      event_type: eventTypeMap[event],
      user_id: req.user?._id || null,
      severity: "INFO",
      source_system: "frontend",
      correlation_id: productId,
      network: {
        ip_address: req.ip || req.headers["x-forwarded-for"] || null,
        user_agent: req.headers["user-agent"] || null,
      },
      metadata: {
        targetType: "product",
        targetId: productId,
        productName: productName || null,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    // Silently fail — never break the user experience for a tracking call
    console.error("[Analytics] trackEvent error:", error);
    return res.json({ success: false });
  }
};

/**
 * Returns behavioral analytics (Peak order times, Error rates)
 * GET /api/v1/admin/analytics/behavioral
 */
export const getBehavioralAnalytics = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const peakOrders = await Order.aggregate([
      { $match: { paymentStatus: { $in: ["paid", "refunded"] } } },
      {
        $group: {
          _id: {
            hour: { $hour: "$createdAt" },
            dayOfWeek: { $dayOfWeek: "$createdAt" }
          },
          orders: { $sum: 1 }
        }
      },
      { $sort: { orders: -1 } },
      { $limit: 24 }
    ]);

    const errorRates = await AuditLogV2.aggregate([
      { $match: { severity: "ERROR" } },
      {
        $group: {
          _id: "$event_type",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({ success: true, data: { peakOrders, errorRates } });
  } catch (error) {
    console.error("[Analytics] Error in getBehavioralAnalytics:", error);
    res.status(500).json({ success: false, message: "Failed to fetch behavioral data" });
  }
};

/**
 * Returns customers who are at risk of churning based on expectedLifespanDays
 * GET /api/v1/admin/analytics/customers-at-risk
 */
export const getCustomersAtRisk = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const atRiskCustomers = await UserProfile.aggregate([
      { $match: { orders: { $exists: true, $not: { $size: 0 } } } },
      {
        $lookup: {
          from: "orders",
          localField: "orders",
          foreignField: "_id",
          as: "orderData"
        }
      },
      { $unwind: "$orderData" },
      { $sort: { "orderData.createdAt": -1 } },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$displayName" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          lastOrderDate: { $first: "$orderData.createdAt" },
          lastOrderItems: { $first: "$orderData.items" }
        }
      },
      { $unwind: "$lastOrderItems" },
      {
        $lookup: {
          from: "products",
          localField: "lastOrderItems.product",
          foreignField: "_id",
          as: "productData"
        }
      },
      { $unwind: { path: "$productData", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          lastOrderDate: { $first: "$lastOrderDate" },
          maxLifespanDays: { $max: { $ifNull: ["$productData.expectedLifespanDays", 45] } }
        }
      },
      {
        $addFields: {
          daysSinceLastOrder: {
            $divide: [{ $subtract: [new Date(), "$lastOrderDate"] }, 1000 * 60 * 60 * 24]
          }
        }
      },
      { $match: { $expr: { $gt: ["$daysSinceLastOrder", "$maxLifespanDays"] } } },
      { $sort: { daysSinceLastOrder: -1 } }
    ]);

    res.json({ success: true, data: atRiskCustomers });
  } catch (error) {
    console.error("[Analytics] Error in getCustomersAtRisk:", error);
    res.status(500).json({ success: false, message: "Failed to fetch at-risk customers" });
  }
};

/**
 * Returns advanced product intelligence metrics (pairings, repeat rate) from the cache view
 * GET /api/v1/admin/analytics/product-intelligence
 */
export const getProductIntelligence = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const intelligence = await ProductIntelligenceView.find()
      .sort({ revenue_generated: -1 })
      .lean();
    res.json({ success: true, data: intelligence });
  } catch (error) {
    console.error("[Analytics] Error in getProductIntelligence:", error);
    res.status(500).json({ success: false, message: "Failed to fetch product intelligence" });
  }
};

export const getMarketingAttribution = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const pipeline = [
      {
        $group: {
          _id: {
            source: { $ifNull: ["$marketing.source", "direct"] },
            medium: { $ifNull: ["$marketing.medium", "none"] }
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" }
        }
      },
      {
        $project: {
          _id: 0,
          source: "$_id.source",
          medium: "$_id.medium",
          totalOrders: 1,
          totalRevenue: 1
        }
      },
      { $sort: { totalRevenue: -1 } }
    ];

    const attribution = await Order.aggregate(pipeline);

    res.json({ success: true, data: attribution });
  } catch (error) {
    console.error("[Analytics] Error in getMarketingAttribution:", error);
    res.status(500).json({ success: false, message: "Failed to fetch marketing attribution" });
  }
};

export const getSearchAnalytics = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    // top searches
    const topSearches = await AuditLogV2.aggregate([
      { $match: { event_type: "SEARCH" } },
      { $group: { _id: "$metadata.query", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { query: "$_id", count: 1, _id: 0 } }
    ]);

    // zero result searches
    const zeroResultSearches = await AuditLogV2.aggregate([
      { $match: { event_type: "SEARCH", "metadata.resultsCount": 0 } },
      { $group: { _id: "$metadata.query", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { query: "$_id", count: 1, _id: 0 } }
    ]);

    res.json({ success: true, data: { topSearches, zeroResultSearches } });
  } catch (error) {
    console.error("[Analytics] Error in getSearchAnalytics:", error);
    res.status(500).json({ success: false, message: "Failed to fetch search analytics" });
  }
};

export const getInventoryForecast = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // 1. ABC Analysis based on trailing 90 days revenue
    const revenuePipeline = [
      { $match: { createdAt: { $gte: ninetyDaysAgo }, orderStatus: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalRevenue: { $sum: { $multiply: ["$items.priceAtPurchase", "$items.quantity"] } }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ];

    const revenueData = await Order.aggregate(revenuePipeline);
    const totalRevenue90d = revenueData.reduce((sum, item) => sum + item.totalRevenue, 0);

    let cumulativeRevenue = 0;
    const abcMap = new Map();
    
    revenueData.forEach(item => {
      cumulativeRevenue += item.totalRevenue;
      const cumulativePercent = cumulativeRevenue / totalRevenue90d;
      let grade = 'C';
      if (cumulativePercent <= 0.8) grade = 'A';
      else if (cumulativePercent <= 0.95) grade = 'B';
      
      abcMap.set(item._id.toString(), { grade, totalRevenue: item.totalRevenue });
    });

    // 2. Velocity based on 30-day sales
    const velocityPipeline = [
      { $match: { createdAt: { $gte: thirtyDaysAgo }, orderStatus: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold30d: { $sum: "$items.quantity" }
        }
      }
    ];

    const velocityData = await Order.aggregate(velocityPipeline);
    const velocityMap = new Map();
    velocityData.forEach(item => velocityMap.set(item._id.toString(), item.totalSold30d));

    // 3. Assemble full inventory forecast
    const products = await Product.find({ isActive: true }).select("pid name stock lowStockThreshold images createdAt").lean();
    
    const forecast = products.map(product => {
      const pidStr = product._id.toString();
      const abcData = abcMap.get(pidStr) || { grade: 'C', totalRevenue: 0 };
      const totalSold30d = velocityMap.get(pidStr) || 0;
      
      const dailyVelocity = totalSold30d / 30;
      const daysRemaining = dailyVelocity > 0 ? Math.floor(product.stock / dailyVelocity) : 999;
      
      const createdDate = new Date(product.createdAt || 0);
      const dataConfidence = createdDate > fourteenDaysAgo ? "low" : "high";

      return {
        _id: product._id,
        pid: product.pid,
        name: product.name,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        images: product.images,
        grade: abcData.grade,
        totalRevenue90d: abcData.totalRevenue,
        dailyVelocity: parseFloat(dailyVelocity.toFixed(2)),
        daysRemaining,
        dataConfidence
      };
    });

    forecast.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
      if (a.daysRemaining === 999 && b.daysRemaining === 999) return 0;
      if (a.daysRemaining === 999) return 1;
      if (b.daysRemaining === 999) return -1;
      return a.daysRemaining - b.daysRemaining;
    });

    res.json({ success: true, data: forecast });
  } catch (error) {
    console.error("[Analytics] Error in getInventoryForecast:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inventory forecast" });
  }
};
