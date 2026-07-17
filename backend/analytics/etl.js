import cron from 'node-cron';
import Order from '../tracker/models.js';
import AuditLogV2 from '../audit/models.js';
import { DailySalesView, ProductVelocityView, CustomerCohortView, ProductIntelligenceView } from './models.js';
import Product from '../products/models.js';
import mongoose from 'mongoose';

/**
 * Normalizes a Date object to a YYYY-MM-DD string
 */
const toDateString = (date) => {
  return date.toISOString().split('T')[0];
};

/**
 * Normalizes a Date object to a YYYY-MM string (Cohort Month)
 */
const toMonthString = (date) => {
  return date.toISOString().substring(0, 7);
};

/**
 * Calculate the difference in months between two dates
 */
const getMonthIndex = (startDate, targetDate) => {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  
  return (targetYear - startYear) * 12 + (targetMonth - startMonth);
};

/**
 * ETL Job: Daily Sales & Revenue
 * Re-aggregates the last 365 days of orders to handle delayed refunds or status changes.
 */
async function aggregateDailySales() {
  // 30-day rolling window — older data is already aggregated and won't change.
  // Scanning 365 days every 2 hours was the primary source of Atlas→Render bandwidth.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Group by day
  const salesData = await Order.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        gross_revenue: {
          $sum: {
            $cond: [
              { $and: [
                { $in: ["$paymentStatus", ["paid", "refunded"]] },
                { $eq: [{ $ifNull: ["$currency", "INR"] }, "INR"] }
              ]}, 
              "$totalAmount", 
              0
            ]
          }
        },
        refunded_amount: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ["$paymentStatus", "refunded"] },
                { $eq: [{ $ifNull: ["$currency", "INR"] }, "INR"] }
              ]}, 
              "$refundAmount", 
              0
            ]
          }
        },
        order_count: {
          $sum: {
            $cond: [
              { $and: [
                { $in: ["$paymentStatus", ["paid", "refunded"]] },
                { $eq: [{ $ifNull: ["$currency", "INR"] }, "INR"] }
              ]}, 
              1, 
              0
            ]
          }
        },
        refund_count: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ["$paymentStatus", "refunded"] },
                { $eq: [{ $ifNull: ["$currency", "INR"] }, "INR"] }
              ]}, 
              1, 
              0
            ]
          }
        }
      }
    }
  ]);

  const bulkOps = salesData.map((day) => ({
    updateOne: {
      filter: { date_string: day._id },
      update: {
        $set: {
          gross_revenue: day.gross_revenue,
          net_revenue: day.gross_revenue - day.refunded_amount,
          order_count: day.order_count,
          refund_count: day.refund_count,
          average_order_value: day.order_count > 0 ? (day.gross_revenue - day.refunded_amount) / day.order_count : 0,
          last_aggregated_at: new Date()
        }
      },
      upsert: true
    }
  }));

  if (bulkOps.length > 0) {
    await DailySalesView.bulkWrite(bulkOps);
  }
}

/**
 * ETL Job: Product Velocity — Purchases
 * Aggregates purchases over the last 365 days from order data.
 */
async function aggregateProductPurchases() {
  // 30-day rolling window — same rationale as aggregateDailySales.
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - 30);

  const productData = await Order.aggregate([
    { $match: { createdAt: { $gte: daysAgo }, paymentStatus: { $in: ["paid", "refunded"] } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          product_id: "$items.product",
          date_string: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
        },
        purchases: { $sum: "$items.quantity" },
        revenue_generated: { $sum: { $multiply: ["$items.quantity", "$items.priceAtPurchase"] } }
      }
    }
  ]);

  const bulkOps = productData.map((data) => ({
    updateOne: {
      filter: { product_id: data._id.product_id, date_string: data._id.date_string },
      update: {
        $set: {
          purchases: data.purchases,
          revenue_generated: data.revenue_generated,
          last_aggregated_at: new Date()
        }
      },
      upsert: true
    }
  }));

  if (bulkOps.length > 0) {
    await ProductVelocityView.bulkWrite(bulkOps);
  }
}

/**
 * ETL Job: Product Velocity — Views (from audit log)
 * Reads product_viewed events and aggregates per product per day.
 */
async function aggregateProductViews() {
  // 30-day rolling window.
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - 30);

  const viewData = await AuditLogV2.aggregate([
    {
      $match: {
        event_type: 'PRODUCT_VIEWED',        // Correct field name in AuditLogV2 schema
        timestamp_utc: { $gte: daysAgo },    // Correct date field
        'metadata.targetId': { $exists: true, $ne: null }  // productId stored here
      }
    },
    {
      $group: {
        _id: {
          product_id: '$metadata.targetId',  // Correct path to productId
          date_string: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp_utc' } }
        },
        views: { $sum: 1 }
      }
    }
  ]);

  const bulkOps = [];
  for (const data of viewData) {
    let productObjectId;
    try {
      productObjectId = new mongoose.Types.ObjectId(data._id.product_id);
    } catch {
      const p = await Product.findOne({ pid: data._id.product_id }).select('_id').lean();
      if (!p) continue;
      productObjectId = p._id;
    }

    bulkOps.push({
      updateOne: {
        filter: { product_id: productObjectId, date_string: data._id.date_string },
        update: { $set: { views: data.views, last_aggregated_at: new Date() } },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await ProductVelocityView.bulkWrite(bulkOps);
  }
}

/**
 * ETL Job: Product Velocity — Cart Adds (from audit log)
 * Reads cart_item_added events and aggregates per product per day.
 */
async function aggregateCartAdds() {
  // 30-day rolling window.
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - 30);

  const cartData = await AuditLogV2.aggregate([
    {
      $match: {
        event_type: 'CART_ITEM_ADDED',        // Correct field name
        timestamp_utc: { $gte: daysAgo },     // Correct date field
        'metadata.targetId': { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: {
          product_id: '$metadata.targetId',  // Correct path
          date_string: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp_utc' } }
        },
        carts: { $sum: 1 }
      }
    }
  ]);

  const bulkOps = [];
  for (const data of cartData) {
    let productObjectId;
    try {
      productObjectId = new mongoose.Types.ObjectId(data._id.product_id);
    } catch {
      const p = await Product.findOne({ pid: data._id.product_id }).select('_id').lean();
      if (!p) continue;
      productObjectId = p._id;
    }

    bulkOps.push({
      updateOne: {
        filter: { product_id: productObjectId, date_string: data._id.date_string },
        update: { $set: { carts: data.carts, last_aggregated_at: new Date() } },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await ProductVelocityView.bulkWrite(bulkOps);
  }
}

/**
 * ETL Job: Customer Cohorts
 * Determines when a user first purchased, and builds retention brackets.
 */
async function aggregateCustomerCohorts() {
  // 1. Find the first purchase date for each user to assign them to a cohort
  const userFirstOrders = await Order.aggregate([
    { $match: { paymentStatus: { $in: ["paid", "refunded"] } } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: "$user",
        firstOrderDate: { $first: "$createdAt" }
      }
    }
  ]);

  const userCohortMap = new Map(); // user_id (string) -> firstOrderDate
  const cohortSizes = new Map(); // YYYY-MM -> total count

  userFirstOrders.forEach((u) => {
    const cohortStr = toMonthString(u.firstOrderDate);
    userCohortMap.set(u._id.toString(), u.firstOrderDate);
    
    cohortSizes.set(cohortStr, (cohortSizes.get(cohortStr) || 0) + 1);
  });

  // 2. Map all subsequent orders to their month_index
  const allOrders = await Order.find({ paymentStatus: { $in: ["paid", "refunded"] } }).select("user createdAt totalAmount");
  
  // Key: "YYYY-MM_monthIndex" -> { active_users: Set, revenue: 0 }
  const cohortActivity = new Map();

  allOrders.forEach((order) => {
    const userIdStr = order.user.toString();
    const firstOrderDate = userCohortMap.get(userIdStr);
    
    if (!firstOrderDate) return;

    const cohortStr = toMonthString(firstOrderDate);
    const monthIdx = getMonthIndex(firstOrderDate, order.createdAt);
    
    // Ignore negative month indexes (anomalies)
    if (monthIdx < 0) return;

    const activityKey = `${cohortStr}_${monthIdx}`;
    
    if (!cohortActivity.has(activityKey)) {
      cohortActivity.set(activityKey, {
        users: new Set(),
        revenue: 0
      });
    }
    
    const activity = cohortActivity.get(activityKey);
    activity.users.add(userIdStr);
    activity.revenue += order.totalAmount;
  });

  // 3. Upsert into DB
  const bulkOps = [];
  
  for (const [key, data] of cohortActivity.entries()) {
    const lastUnderscore = key.lastIndexOf("_");
    const cohort_month = key.substring(0, lastUnderscore);
    const monthIndexStr = key.substring(lastUnderscore + 1);
    const month_index = parseInt(monthIndexStr, 10);
    const total_users = cohortSizes.get(cohort_month) || 0;

    bulkOps.push({
      updateOne: {
        filter: { cohort_month, month_index },
        update: {
          $set: {
            total_users_in_cohort: total_users,
            active_users: data.users.size,
            revenue_retained: data.revenue,
            last_aggregated_at: new Date()
          }
        },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await CustomerCohortView.bulkWrite(bulkOps);
  }
}

/**
 * ETL Job: Advanced Product Intelligence
 * Calculates Repeat Purchase Rate and Frequently Bought Together pairings (threshold >= 3).
 */
async function aggregateProductIntelligence() {
  // 1. Get all orders to calculate pairings and base revenue
  // 🚀 OPTIMIZATION: Only select fields needed to avoid huge payloads and bandwidth exhaustion on free tier
  const allOrders = await Order.find({ paymentStatus: { $in: ["paid", "refunded"] } })
    .select('items user')
    .populate('items.product', 'name')
    .lean();

  const productStats = new Map(); // product_id -> stats
  const productPairings = new Map(); // product_id -> Map(paired_product_id -> count)

  // 2. Iterate orders and build pairings / revenue
  for (const order of allOrders) {
    if (!order.items || order.items.length === 0) continue;

    const itemIds = order.items.map(i => i.product?._id?.toString()).filter(Boolean);
    const userId = order.user?.toString();

    for (const item of order.items) {
      if (!item.product || !item.product._id) continue;
      
      const pidStr = item.product._id.toString();
      
      if (!productStats.has(pidStr)) {
        productStats.set(pidStr, {
          product_id: item.product._id,
          product_name: item.product.name || 'Unknown',
          revenue_generated: 0,
          buyers: new Map() // userId -> purchaseCount
        });
        productPairings.set(pidStr, new Map());
      }

      const stats = productStats.get(pidStr);
      stats.revenue_generated += (item.priceAtPurchase * item.quantity);
      
      if (userId) {
        const userCount = stats.buyers.get(userId) || 0;
        stats.buyers.set(userId, userCount + item.quantity);
      }

      // Pairings
      const pairings = productPairings.get(pidStr);
      for (const otherIdStr of itemIds) {
        if (otherIdStr !== pidStr) {
          const currentCount = pairings.get(otherIdStr) || { count: 0, name: '' };
          // Find the name of the other product from the order items
          const otherItem = order.items.find(i => i.product?._id?.toString() === otherIdStr);
          pairings.set(otherIdStr, {
            count: currentCount.count + 1,
            name: otherItem?.product?.name || 'Unknown'
          });
        }
      }
    }
  }

  // 3. Compile final metrics and filter pairings >= 3
  const bulkOps = [];
  
  for (const [pidStr, stats] of productStats.entries()) {
    let totalUniqueBuyers = stats.buyers.size;
    let repeatBuyers = 0;
    
    for (const count of stats.buyers.values()) {
      if (count > 1) repeatBuyers++;
    }

    const repeat_purchase_rate = totalUniqueBuyers > 0 
      ? Math.round((repeatBuyers / totalUniqueBuyers) * 100) 
      : 0;

    const pairingsMap = productPairings.get(pidStr);
    const frequently_bought_together = [];
    
    for (const [pairedIdStr, pairedData] of pairingsMap.entries()) {
      if (pairedData.count >= 3) {
        frequently_bought_together.push({
          paired_product_id: pairedIdStr,
          paired_product_name: pairedData.name,
          co_occurrences: pairedData.count
        });
      }
    }

    // Sort pairings descending
    frequently_bought_together.sort((a, b) => b.co_occurrences - a.co_occurrences);

    bulkOps.push({
      updateOne: {
        filter: { product_id: stats.product_id },
        update: {
          $set: {
            product_name: stats.product_name,
            repeat_purchase_rate,
            total_unique_buyers: totalUniqueBuyers,
            revenue_generated: stats.revenue_generated,
            frequently_bought_together
          }
        },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await ProductIntelligenceView.bulkWrite(bulkOps);
  }
}

/**
 * Fast incremental ETL — only the last 30 days of data.
 * These four jobs are cheap because they only touch recent records.
 */
export async function runIncrementalETL() {
  console.log("[Analytics ETL] Starting incremental aggregation (30-day window)...");
  const start = Date.now();
  try {
    await aggregateDailySales();
    await aggregateProductPurchases();
    await aggregateProductViews();
    await aggregateCartAdds();
    console.log(`[Analytics ETL] Incremental aggregation completed in ${Date.now() - start}ms.`);
  } catch (err) {
    console.error("[Analytics ETL] Incremental aggregation failed:", err);
  }
}

/**
 * Slow full-scan ETL — cohort and intelligence jobs scan all-time data.
 * Run once daily (3:30 AM) instead of every 2 hours.
 */
export async function runFullETL() {
  console.log("[Analytics ETL] Starting full (all-time) aggregation...");
  const start = Date.now();
  try {
    // Run incremental jobs first so the daily run also refreshes recent metrics
    await aggregateDailySales();
    await aggregateProductPurchases();
    await aggregateProductViews();
    await aggregateCartAdds();
    await aggregateCustomerCohorts();
    await aggregateProductIntelligence();
    console.log(`[Analytics ETL] Full aggregation completed in ${Date.now() - start}ms.`);
  } catch (err) {
    console.error("[Analytics ETL] Full aggregation failed:", err);
  }
}

/**
 * @deprecated Use runIncrementalETL or runFullETL directly.
 * Kept for backward compatibility with any manual admin triggers.
 */
export async function runETL() {
  return runFullETL();
}

/**
 * Schedule analytics cron jobs.
 *
 * Tier 1 — incremental (every 2h): re-aggregates the last 30 days.
 *   Scans ~1/12th the data compared to the previous 365-day window.
 *
 * Tier 2 — full scan (daily at 3:30 AM): adds cohort + product-intelligence
 *   which need all-time data but change slowly. Moved off the 2-hour schedule
 *   to stop scanning millions of rows 12 times per day.
 *
 * Startup burst removed: the previous 5-second startup run fired on every
 * deploy, causing a bandwidth spike before the process was fully warm.
 * Fresh data is available within 2 hours of deploy.
 */
export function initAnalyticsCron() {
  if (process.env.NODE_ENV !== 'test') {
    // Tier 1: lightweight incremental — every 2 hours
    cron.schedule('0 */2 * * *', () => {
      runIncrementalETL().catch(err => console.error("[Analytics ETL] Incremental cron failed:", err));
    });
    console.log("[Analytics ETL] Incremental cron scheduled (every 2 hours, 30-day window).");

    // Tier 2: expensive full-scan — once daily at 3:30 AM
    cron.schedule('30 3 * * *', () => {
      runFullETL().catch(err => console.error("[Analytics ETL] Full cron failed:", err));
    });
    console.log("[Analytics ETL] Full cron scheduled (daily at 03:30).");
  }
}
