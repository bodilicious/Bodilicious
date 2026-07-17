import Order from "../tracker/models.js";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";
import { Ticket } from "../support/models.js";
import RitualResponse from "./ritualModels.js";
import AuditLogV2 from "../audit/models.js";

/**
 * GET /api/v1/admin/analytics/sales?startDate=&endDate=
 */
export const getSalesAnalytics = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
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
          grossRevenue: { 
            $sum: {
              $cond: [{ $eq: [{ $ifNull: ["$currency", "INR"] }, "INR"] }, "$totalAmount", 0]
            } 
          },
          netRevenue: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $not: { $in: ["$orderStatus", ["returned", "cancelled"]] } },
                  { $eq: [{ $ifNull: ["$currency", "INR"] }, "INR"] }
                ]}, 
                "$totalAmount",
                0
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
          totalRevenue: { 
            $sum: {
              $cond: [{ $eq: [{ $ifNull: ["$currency", "INR"] }, "INR"] }, "$totalAmount", 0]
            }
          },
          netRevenue: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $not: { $in: ["$orderStatus", ["returned", "cancelled"]] } },
                  { $eq: [{ $ifNull: ["$currency", "INR"] }, "INR"] }
                ]}, 
                "$totalAmount",
                0
              ] 
            } 
          },
          foreignOrdersCount: {
            $sum: {
              $cond: [{ $ne: [{ $ifNull: ["$currency", "INR"] }, "INR"] }, 1, 0]
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
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
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

    // Refund Processing Time
    const refundProcessing = await Order.aggregate([
      { 
        $match: { 
          ...query, 
          returnRequestedAt: { $type: "date" }, 
          returnResolvedAt: { $type: "date" } 
        } 
      },
      {
        $addFields: {
          processingDays: {
            $divide: [
              { $subtract: ["$returnResolvedAt", "$returnRequestedAt"] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $facet: {
          histogram: [
            {
              $bucket: {
                groupBy: "$processingDays",
                boundaries: [0, 1, 3, 7, 999999],
                default: "Other",
                output: { count: { $sum: 1 } }
              }
            }
          ],
          monthlyTrend: [
            {
              $group: {
                _id: {
                  year: { $year: "$returnResolvedAt" },
                  month: { $month: "$returnResolvedAt" }
                },
                avgProcessingDays: { $avg: "$processingDays" }
              }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
            {
              $project: {
                _id: 0,
                month: { $concat: [{ $toString: "$_id.year" }, "-", { $toString: "$_id.month" }] },
                avgProcessingDays: 1
              }
            }
          ],
          gauge: [
            {
              $group: {
                _id: null,
                overallAvg: { $avg: "$processingDays" }
              }
            }
          ]
        }
      }
    ]);

    res.json({ 
      success: true, 
      data: { 
        topSelling, 
        categoryRevenue,
        returnRates: returnRates.slice(0, 10),
        refundProcessing: refundProcessing[0]
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
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
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
    
    // Batch aggregate — one query for ALL out-of-stock products instead of N separate queries.
    // The previous approach fired one Order.aggregate per out-of-stock product, which generated
    // N round-trips to Atlas on every admin analytics page load.
    let stockoutImpact = [];
    if (outOfStock.length > 0) {
      const outOfStockIds = outOfStock.map(p => p._id);
      const salesBatch = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            paymentStatus: "paid",
            "items.product": { $in: outOfStockIds }
          }
        },
        { $unwind: "$items" },
        { $match: { "items.product": { $in: outOfStockIds } } },
        {
          $group: {
            _id: "$items.product",
            totalSold: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.quantity", "$items.priceAtPurchase"] } }
          }
        }
      ]);

      const salesMap = new Map(salesBatch.map(s => [s._id.toString(), s]));

      stockoutImpact = outOfStock.map(p => {
        const stats = salesMap.get(p._id.toString()) || { totalSold: 0, revenue: 0 };
        return {
          name: p.name,
          pid: p.pid,
          estimatedDailyLoss: parseFloat((stats.revenue / 30).toFixed(2)),
          totalSoldLast30: stats.totalSold
        };
      }).sort((a, b) => b.estimatedDailyLoss - a.estimatedDailyLoss).slice(0, 10);
    }

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
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
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

    // Customer Support / Tickets
    const ticketTrends = await Ticket.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            dayOfWeek: { $dayOfWeek: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          dayOfWeek: "$_id.dayOfWeek",
          count: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    const topIssues = await Ticket.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          type: "$_id",
          count: 1
        }
      }
    ]);

    const resolutionRaw = await Ticket.aggregate([
      { $match: query },
      {
        $project: {
          type: 1,
          createdAt: 1,
          resolvedAt: 1,
          messages: 1
        }
      }
    ]);
    
    const resolutionTimes = {
      overall: { frt: [], ttr: [] },
      byType: {}
    };

    resolutionRaw.forEach(t => {
       const type = t.type || "other";
       if (!resolutionTimes.byType[type]) resolutionTimes.byType[type] = { frt: [], ttr: [] };
       
       if (t.resolvedAt) {
          const ttr = (t.resolvedAt - t.createdAt) / (1000 * 60 * 60); // hours
          resolutionTimes.overall.ttr.push(ttr);
          resolutionTimes.byType[type].ttr.push(ttr);
       }
       
       const adminMsgs = (t.messages || []).filter(m => m.authorRole === "admin" || m.authorRole === "system");
       if (adminMsgs && adminMsgs.length > 0) {
          const firstAdminMsg = adminMsgs[0];
          // Schema timestamps create createdAt on subdocuments usually, or fall back
          const msgTime = firstAdminMsg.createdAt || t.createdAt;
          const frt = msgTime - t.createdAt; 
          const frtHours = Math.max(0, frt / (1000 * 60 * 60));
          resolutionTimes.overall.frt.push(frtHours);
          resolutionTimes.byType[type].frt.push(frtHours);
       }
    });

    res.json({ 
      success: true, 
      data: { 
        segmentStats, 
        funnelData,
        trendData,
        support: {
          ticketTrends,
          topIssues,
          resolutionTimes
        }
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
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const { startDate, endDate, pincodeState } = req.query;
    const matchQuery = { orderStatus: { $nin: ["abandoned", "pending"] } };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // 1. Carrier Performance
    const carrierPerformance = await Order.aggregate([
      { $match: { ...matchQuery, orderStatus: "delivered", deliveredAt: { $type: "date" } } },
      {
        $group: {
          _id: { $ifNull: ["$estimatedCourierName", "Unknown"] },
          count: { $sum: 1 },
          avgOrderToDeliveryDays: {
            $avg: { $divide: [{ $subtract: ["$deliveredAt", "$createdAt"] }, 1000 * 60 * 60 * 24] }
          },
          avgCarrierTransitDays: {
            $avg: {
              $cond: [
                { $eq: [{ $type: "$shippedAt" }, "date"] },
                { $divide: [{ $subtract: ["$deliveredAt", "$shippedAt"] }, 1000 * 60 * 60 * 24] },
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          courier_name: "$_id",
          count: 1,
          avgOrderToDeliveryDays: 1,
          avgCarrierTransitDays: 1
        }
      }
    ]);

    // 2. Heatmap
    // a. State level (always returned)
    const stateHeatmap = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $ifNull: ["$shippingDetails.state", "Unknown"] },
          order_count: { $sum: 1 },
          avg_shipping_cost: { $avg: "$shippingCost" }
        }
      },
      { $sort: { order_count: -1 } },
      {
        $project: {
          _id: 0,
          state: "$_id",
          order_count: 1,
          avg_shipping_cost: 1
        }
      }
    ]);

    // b. Pincode level drill-down (if requested)
    let pincodeHeatmap = [];
    if (pincodeState) {
       pincodeHeatmap = await Order.aggregate([
         { $match: { ...matchQuery, "shippingDetails.state": pincodeState } },
         {
           $group: {
             _id: { $ifNull: ["$shippingDetails.pincode", "Unknown"] },
             order_count: { $sum: 1 },
             avg_shipping_cost: { $avg: "$shippingCost" }
           }
         },
         { $sort: { order_count: -1 } },
         { $limit: 50 },
         {
           $project: {
             _id: 0,
             pincode: "$_id",
             order_count: 1,
             avg_shipping_cost: 1
           }
         }
       ]);
    }

    // 3. Cost Analysis (Scatter plot) — capped at 500 points, scatter charts don't render more usefully
    const costAnalysis = await Order.aggregate([
      { $match: { ...matchQuery, totalAmount: { $gt: 0, $lte: 50000 } } },
      {
        $project: {
          _id: 0,
          order_id: "$_id",
          totalAmount: 1,
          shippingCost: 1,
          freight_pct_of_value: {
            $multiply: [ { $divide: ["$shippingCost", "$totalAmount"] }, 100 ]
          }
        }
      },
      { $limit: 500 }
    ]);

    // 4. RTO Rate
    const funnelStages = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total_processed: { $sum: 1 },
          shipped: {
            $sum: {
              $cond: [
                { $or: [
                  { $in: ["$orderStatus", ["shipped", "delivered", "returned", "return_requested"]] },
                  { $eq: [{ $type: "$shippedAt" }, "date"] }
                ]},
                1,
                0
              ]
            }
          },
          delivered: {
            $sum: {
              $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0]
            }
          },
          rto: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ["$orderStatus", "returned"] },
                  { $in: ["$returnStatus", ["none", null]] }
                ]},
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // RTO Reasons Donut
    const rtoReasons = await Order.aggregate([
      { $match: { ...matchQuery, orderStatus: "returned", returnStatus: { $in: ["none", null] } } },
      {
        $group: {
          _id: { $ifNull: ["$rtoReason", "Courier RTO"] },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          reason: "$_id",
          count: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        carrierPerformance,
        heatmap: {
          state: stateHeatmap,
          pincode: pincodeHeatmap
        },
        costAnalysis,
        funnel: funnelStages[0] || { total_processed: 0, shipped: 0, delivered: 0, rto: 0 },
        rtoReasons
      }
    });

  } catch (err) {
    console.error("Operation Analytics Error:", err);
    res.status(500).json({ success: false, message: "Error fetching operation analytics" });
  }
};
/**
 * GET /api/v1/admin/analytics/orders
 */
export const getOrderAnalytics = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
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
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30");
    const { startDate, endDate } = req.query;
    
    const query = {};
    const auditQuery = {};
    
    if (startDate || endDate) {
      query.createdAt = {};
      auditQuery.timestamp_utc = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
        auditQuery.timestamp_utc.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
        auditQuery.timestamp_utc.$lte = new Date(endDate);
      }
    }

    // Peak order heatmap: { hour, dayOfWeek, dayOfMonth, month, orders }
    const peakOrders = await Order.aggregate([
      { $match: { ...query, orderStatus: { $nin: ["abandoned", "cancelled"] } } },
      {
        $group: {
          _id: {
            hour: { $hour: "$createdAt" },
            dayOfWeek: { $dayOfWeek: "$createdAt" }, // 1=Sun, 7=Sat
            dayOfMonth: { $dayOfMonth: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          orders: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          hour: "$_id.hour",
          dayOfWeek: "$_id.dayOfWeek",
          dayOfMonth: "$_id.dayOfMonth",
          month: "$_id.month",
          orders: 1
        }
      },
      { $sort: { month: 1, dayOfMonth: 1, dayOfWeek: 1, hour: 1 } }
    ]);

    // Backend error rates by event_type
    const backendErrors = await AuditLogV2.aggregate([
      { $match: { ...auditQuery, severity: "ERROR" } },
      {
        $group: {
          _id: "$event_type",
          count: { $sum: 1 },
          lastSeen: { $max: "$timestamp_utc" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $project: { _id: 0, event_type: "$_id", count: 1, lastSeen: 1, category: { $literal: "backend" } } }
    ]);

    // Checkout failures: orders that were created but payment failed or status is failed/pending old
    const checkoutFailures = await Order.aggregate([
      {
        $match: {
          ...query,
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

    // Gateway breakdown (AuditLog PAYMENT_FAILED)
    const gatewayBreakdown = await AuditLogV2.aggregate([
      { $match: { ...auditQuery, event_type: "PAYMENT_FAILED" } },
      {
        $group: {
          _id: "$metadata.reason",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, reason: { $ifNull: ["$_id", "unknown_error"] }, count: 1 } }
    ]);

    const checkoutFailureTotal = checkoutFailures.reduce((s, d) => s + d.count, 0);
    const checkoutRevenueLost = checkoutFailures.reduce((s, d) => s + d.totalAmount, 0);

    res.json({
      success: true,
      data: {
        peakOrders,
        backendErrors,
        errorRates: {
          checkoutFailures,
          gatewayBreakdown,
          backendErrors
        },
        // Kept for backward compatibility
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

export const getErrorDashboardData = async (req, res) => {
  try {
    const { from, to, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let startDate, endDate;
    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    }

    const auditQuery = {
      timestamp_utc: { $gte: startDate, $lte: endDate }
    };
    
    const query = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    const checkoutFailures = await Order.aggregate([
      {
        $match: {
          ...query,
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

    let gatewayBreakdown = await AuditLogV2.aggregate([
      { $match: { ...auditQuery, event_type: "PAYMENT_FAILED" } },
      {
        $group: {
          _id: "$metadata.reason",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, reason: { $ifNull: ["$_id", "unknown_error"] }, count: 1 } }
    ]);

    if (gatewayBreakdown.length === 0) {
      gatewayBreakdown = await Order.aggregate([
        {
          $match: {
            ...query,
            paymentStatus: { $in: ["failed", "pending"] },
            orderStatus: { $in: ["pending", "payment_failed"] }
          }
        },
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        {
          $project: {
            _id: 0,
            reason: {
              $cond: { if: { $eq: ["$_id", "failed"] }, then: "Payment Gateway Rejected", else: "Abandoned Checkout / Pending Payment" }
            },
            count: 1
          }
        }
      ]);
    }

    let paymentFailureRows = await AuditLogV2.find({ ...auditQuery, event_type: "PAYMENT_FAILED" })
      .populate("user_id", "name email")
      .sort({ timestamp_utc: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    let paymentFailureTotal = await AuditLogV2.countDocuments({ ...auditQuery, event_type: "PAYMENT_FAILED" });

    // Fallback: If AuditLogV2 has no records, use Order collection so the details table isn't empty
    if (paymentFailureRows.length === 0) {
      const failedOrders = await Order.find({
        ...query,
        paymentStatus: { $in: ["failed", "pending"] },
        orderStatus: { $in: ["pending", "payment_failed"] }
      })
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      paymentFailureRows = failedOrders.map(order => ({
        _id: order._id,
        timestamp_utc: order.createdAt,
        user_id: order.user,
        metadata: {
          reason: order.paymentStatus === "failed" ? "Payment Gateway Rejected" : "Abandoned Checkout / Pending Payment",
          email: order.shippingDetails?.email || "",
          amount: order.totalAmount
        }
      }));

      paymentFailureTotal = await Order.countDocuments({
        ...query,
        paymentStatus: { $in: ["failed", "pending"] },
        orderStatus: { $in: ["pending", "payment_failed"] }
      });
    }

    const systemErrorRows = await AuditLogV2.find({ ...auditQuery, severity: "ERROR" })
      .sort({ timestamp_utc: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const systemErrorTotal = await AuditLogV2.countDocuments({ ...auditQuery, severity: "ERROR" });

    res.json({
      success: true,
      data: {
        checkoutFailures,
        gatewayBreakdown,
        paymentFailureRows,
        systemErrorRows,
        paymentFailureTotal,
        systemErrorTotal
      }
    });
  } catch (error) {
    console.error("[Analytics] Error in getErrorDashboardData:", error);
    res.status(500).json({ success: false, message: "Failed to fetch error dashboard data" });
  }
};
