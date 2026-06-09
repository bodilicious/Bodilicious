import Order from "../tracker/models.js";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";
import RitualResponse from "./ritualModels.js";
import AuditLogV2 from "../audit/models.js";

/**
 * GET /api/v1/admin/analytics/sales?startDate=&endDate=
 */
export const getSalesAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Gross vs Net Revenue Trend
    const salesTrend = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          grossRevenue: { $sum: "$totalAmount" },
          netRevenue: { 
            $sum: { 
              $cond: [
                { $in: ["$orderStatus", ["returned", "cancelled"]] }, 
                0, 
                "$totalAmount" 
              ] 
            } 
          },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Payment Method Split
    const paymentSplit = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          revenue: { $sum: "$totalAmount" }
        }
      }
    ]);

    // Metrics for KPI Cards
    const stats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          netRevenue: { 
            $sum: { 
              $cond: [
                { $in: ["$orderStatus", ["returned", "cancelled"]] }, 
                0, 
                "$totalAmount" 
              ] 
            } 
          },
          totalOrders: { $sum: 1 },
          newCustomers: { $addToSet: "$user" } // Rough estimate for now
        }
      }
    ]);

    const summary = stats[0] || { totalRevenue: 0, netRevenue: 0, totalOrders: 0, newCustomers: [] };
    const aov = summary.totalOrders > 0 ? (summary.netRevenue / summary.totalOrders).toFixed(2) : 0;

    res.json({ 
      success: true, 
      data: { 
        salesTrend, 
        paymentSplit,
        summary: {
          ...summary,
          newCustomers: summary.newCustomers.length,
          aov: parseFloat(aov)
        }
      } 
    });
  } catch (err) {
    console.error("Sales Analytics Error:", err);
    res.status(500).json({ success: false, message: "Error fetching sales analytics" });
  }
};

/**
 * GET /api/v1/admin/analytics/products?startDate=&endDate=
 */
export const getProductAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [topSelling, categoryRevenue] = await Promise.all([
      // Top Selling Products in range
      Order.aggregate([
        { $match: { ...query, paymentStatus: "paid" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            totalSold: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.quantity", "$items.priceAtPurchase"] } }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" }
      ]),
      // Category Revenue Share
      Order.aggregate([
        { $match: { ...query, paymentStatus: "paid" } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: "$productInfo.category",
            revenue: { $sum: { $multiply: ["$items.quantity", "$items.priceAtPurchase"] } },
            unitsSold: { $sum: "$items.quantity" }
          }
        },
        { $sort: { revenue: -1 } }
      ])
    ]);

    // Return Analytics (Simplified version of returnController logic for the range)
    const returnsByProduct = await Order.aggregate([
      { $match: { ...query, returnStatus: { $ne: "none" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          returnCount: { $sum: "$items.quantity" },
          reasons: { $push: "$returnReason" }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" }
    ]);

    // Calculate return rates by merging with sales data
    const returnRates = returnsByProduct.map(r => {
        const sold = topSelling.find(s => s._id.toString() === r._id.toString());
        const unitsSold = sold ? sold.totalSold : 0; // This is only for top 10, might need a broader join
        return {
            name: r.productInfo.name,
            pid: r.productInfo.pid,
            returnCount: r.returnCount,
            unitsSold, // Note: this is a limitation if not in top 10
            returnRate: unitsSold > 0 ? parseFloat(((r.returnCount / unitsSold) * 100).toFixed(1)) : 0
        };
    }).sort((a, b) => b.returnRate - a.returnRate);

    res.json({ 
      success: true, 
      data: { 
        topSelling, 
        categoryRevenue,
        returnRates: returnRates.slice(0, 10)
      } 
    });
  } catch (err) {
    console.error("Product Analytics Error:", err);
    res.status(500).json({ success: false, message: "Error fetching product analytics" });
  }
};

/**
 * GET /api/v1/admin/analytics/inventory
 */
export const getInventoryAnalytics = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Slow Moving Inventory
    // Find all active products
    const activeProducts = await Product.find({ isActive: true }, "name pid stock price category").lean();
    
    // Find all products sold in last 30 days
    const recentlySoldResult = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, paymentStatus: "paid" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.product" } }
    ]);
    const recentlySoldIds = new Set(recentlySoldResult.map(r => r._id.toString()));

    const slowMoving = activeProducts
      .filter(p => !recentlySoldIds.has(p._id.toString()))
      .map(p => ({
        name: p.name,
        pid: p.pid,
        stock: p.stock,
        price: p.price,
        value: p.stock * p.price
      }))
      .sort((a, b) => b.value - a.value);

    // 2. Stockout Impact
    // Identify currently out of stock products
    const outOfStock = activeProducts.filter(p => p.stock === 0);
    
    // Estimate daily revenue for these products based on previous 30-day performance (when they were in stock)
    // For simplicity, we'll just look at their average daily sales in the last 30 days overall
    const stockoutImpact = await Promise.all(outOfStock.map(async (p) => {
        const sales = await Order.aggregate([
            { $match: { 
                createdAt: { $gte: thirtyDaysAgo }, 
                paymentStatus: "paid",
                "items.product": p._id 
            } },
            { $unwind: "$items" },
            { $match: { "items.product": p._id } },
            { $group: { _id: null, totalSold: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.quantity", "$items.priceAtPurchase"] } } } }
        ]);

        const stats = sales[0] || { totalSold: 0, revenue: 0 };
        const dailyRevenue = stats.revenue / 30;
        
        return {
            name: p.name,
            pid: p.pid,
            estimatedDailyLoss: parseFloat(dailyRevenue.toFixed(2)),
            totalSoldLast30: stats.totalSold
        };
    }));

    res.json({ 
      success: true, 
      data: { 
        slowMoving: slowMoving.slice(0, 20), 
        stockoutImpact: stockoutImpact.sort((a, b) => b.estimatedDailyLoss - a.estimatedDailyLoss).slice(0, 10)
      } 
    });
  } catch (err) {
    console.error("Inventory Analytics Error:", err);
    res.status(500).json({ success: false, message: "Error fetching inventory analytics" });
  }
};

/**
 * GET /api/v1/admin/analytics/customers?startDate=&endDate=
 */
export const getCustomerAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const segments = ["new", "loyal", "at_risk", "high_value"];
    
    // Segment Revenue & CLV
    const segmentStats = await Promise.all(segments.map(async (seg) => {
      const usersInSeg = await UserProfile.find({ segment: seg }, "_id").lean();
      const userIds = usersInSeg.map(u => u._id);
      
      const stats = await Order.aggregate([
        { $match: { ...query, user: { $in: userIds }, paymentStatus: "paid" } },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalAmount" },
            orderCount: { $sum: 1 }
          }
        }
      ]);
      
      const s = stats[0] || { revenue: 0, orderCount: 0 };
      return {
        segment: seg,
        customerCount: userIds.length,
        revenue: s.revenue,
        orderCount: s.orderCount,
        aov: s.orderCount > 0 ? parseFloat((s.revenue / s.orderCount).toFixed(2)) : 0,
        clv: userIds.length > 0 ? parseFloat((s.revenue / userIds.length).toFixed(2)) : 0
      };
    }));

    // New vs Returning Trend — batch approach, no N+1
    // Step 1: Get all orders in range
    const ordersInRange = await Order.find(
      { ...query, paymentStatus: "paid" },
      "user createdAt"
    ).lean();

    // Step 2: Collect unique user IDs across the range
    const userIdsInRange = [...new Set(ordersInRange.map(o => o.user?.toString()).filter(Boolean))];

    // Step 3: Single batch aggregate — find the first-ever order date for each user in the set
    const { default: mongoose } = await import("mongoose");
    const firstOrderBatch = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          user: { $in: userIdsInRange.map(id => new mongoose.Types.ObjectId(id)) }
        }
      },
      { $group: { _id: "$user", firstOrderDate: { $min: "$createdAt" } } }
    ]);


    // Build a lookup map: userId -> their first-ever order date
    const firstOrderMap = new Map();
    firstOrderBatch.forEach(r => firstOrderMap.set(r._id.toString(), r.firstOrderDate));

    // Step 4: Classify each order in memory by month
    const rangeStartDate = query.createdAt?.$gte || new Date(0);
    const monthMap = new Map();
    ordersInRange.forEach(order => {
      const monthKey = order.createdAt.toISOString().slice(0, 7);
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { date: monthKey, newBuyers: 0, returningBuyers: 0 });
      const bucket = monthMap.get(monthKey);
      const userId = order.user?.toString();
      const firstDate = userId ? firstOrderMap.get(userId) : null;
      // If their very first order falls within the range start date, they're "new" for this period
      if (!firstDate || firstDate >= rangeStartDate) {
        bucket.newBuyers++;
      } else {
        bucket.returningBuyers++;
      }
    });
    const trendData = Array.from(monthMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    // Retention Funnel Data (Rough distribution of purchase counts)
    const funnelData = await Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: "$user", count: { $sum: 1 } } },
        { 
            $group: { 
                _id: {
                    $switch: {
                        branches: [
                            { case: { $gte: ["$count", 4] }, then: "Loyal (4+)" },
                            { case: { $eq: ["$count", 3] }, then: "3rd Purchase" },
                            { case: { $eq: ["$count", 2] }, then: "2nd Purchase" }
                        ],
                        default: "New"
                    }
                },
                count: { $sum: 1 }
            }
        }
    ]);

    res.json({ 
      success: true, 
      data: { 
        segmentStats, 
        funnelData,
        trendData
      } 
    });
  } catch (err) {
    console.error("Customer Analytics Error:", err);
    res.status(500).json({ success: false, message: "Error fetching customer analytics" });
  }
};

/**
 * GET /api/v1/admin/analytics/operations
 */
export const getOperationAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { orderStatus: "delivered" };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Shipping Efficiency (Placed -> Fulfilled/Delivered)
    const orders = await Order.find(query, "createdAt statusHistory").lean();
    
    let totalTime = 0;
    let count = 0;
    const slaBreakdown = { "1 day": 0, "2 days": 0, "3 days": 0, "4+ days": 0 };

    orders.forEach(o => {
      const deliveredStatus = o.statusHistory.find(h => h.status === "delivered");
      if (deliveredStatus) {
        const diffDays = Math.ceil((deliveredStatus.changedAt - o.createdAt) / (1000 * 60 * 60 * 24));
        totalTime += diffDays;
        count++;

        if (diffDays <= 1) slaBreakdown["1 day"]++;
        else if (diffDays <= 2) slaBreakdown["2 days"]++;
        else if (diffDays <= 3) slaBreakdown["3 days"]++;
        else slaBreakdown["4+ days"]++;
      }
    });

    res.json({
      success: true,
      data: {
        avgFulfillmentDays: count > 0 ? (totalTime / count).toFixed(1) : 0,
        slaBreakdown,
        totalDelivered: count
      }
    });

  } catch (err) {
    console.error("Operation Analytics Error:", err);
    res.status(500).json({ success: false, message: "Error fetching operation analytics" });
  }
};

/**
 * GET /api/v1/admin/analytics/ritual-finder
 */
export const getRitualAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [skinTypes, concerns, funnel] = await Promise.all([
      // Skin Type Distribution
      RitualResponse.aggregate([
        { $match: { ...query, skinType: { $ne: null } } },
        { $group: { _id: "$skinType", count: { $sum: 1 } } }
      ]),
      // Top Concerns
      RitualResponse.aggregate([
        { $match: { ...query, concerns: { $ne: [] } } },
        { $unwind: "$concerns" },
        { $group: { _id: "$concerns", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      // Funnel
      RitualResponse.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: { skinTypes, concerns, funnel }
    });
  } catch (err) {
    console.error("Ritual Analytics Error:", err);
    res.status(500).json({ success: false, message: "Error fetching ritual analytics" });
  }
};

/**
 * GET /api/v1/admin/analytics/orders
 */
export const getOrderAnalytics = async (req, res) => {
  try {
    const [statusDist, paymentDist] = await Promise.all([
      Order.aggregate([
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $group: { _id: "$paymentMethod", count: { $sum: 1 } } }
      ])
    ]);

    res.json({ success: true, data: { statusDistribution: statusDist, paymentDistribution: paymentDist } });
  } catch (err) {
    console.error("Order Analytics Error:", err);
    res.status(500).json({ success: false, message: "Error fetching order analytics" });
  }
};

/**
 * GET /api/v1/admin/analytics/behavioral
 * Returns:
 *   - peakOrders: orders grouped by hour and dayOfWeek for a heatmap
 *   - errorRates: backend ERROR audit events + checkout failures, by event_type
 */
export const getBehavioralAnalytics = async (req, res) => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Peak order heatmap: { hour, dayOfWeek, orders }
    const peakOrders = await Order.aggregate([
      { $match: { paymentStatus: { $in: ["paid", "refunded"] }, createdAt: { $gte: ninetyDaysAgo } } },
      {
        $group: {
          _id: {
            hour: { $hour: "$createdAt" },
            dayOfWeek: { $dayOfWeek: "$createdAt" } // 1=Sun, 7=Sat
          },
          orders: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          hour: "$_id.hour",
          dayOfWeek: "$_id.dayOfWeek",
          orders: 1
        }
      },
      { $sort: { dayOfWeek: 1, hour: 1 } }
    ]);

    // Backend error rates by event_type (last 90 days)
    const backendErrors = await AuditLogV2.aggregate([
      { $match: { severity: "ERROR", createdAt: { $gte: ninetyDaysAgo } } },
      {
        $group: {
          _id: "$event_type",
          count: { $sum: 1 },
          lastSeen: { $max: "$createdAt" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $project: { _id: 0, event_type: "$_id", count: 1, lastSeen: 1, category: { $literal: "backend" } } }
    ]);

    // Checkout failures: orders that were created but payment failed or status is failed/pending old
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const checkoutFailures = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          paymentStatus: { $in: ["failed", "pending"] },
          orderStatus: { $in: ["pending", "payment_failed"] }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", count: 1, totalAmount: 1 } }
    ]);

    const checkoutFailureTotal = checkoutFailures.reduce((s, d) => s + d.count, 0);
    const checkoutRevenueLost = checkoutFailures.reduce((s, d) => s + d.totalAmount, 0);

    res.json({
      success: true,
      data: {
        peakOrders,
        backendErrors,
        checkoutFailures,
        checkoutFailureTotal,
        checkoutRevenueLost
      }
    });
  } catch (error) {
    console.error("[Analytics] Error in getBehavioralAnalytics:", error);
    res.status(500).json({ success: false, message: "Failed to fetch behavioral analytics" });
  }
};
