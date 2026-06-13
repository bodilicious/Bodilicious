const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/bodilicious');
  
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
  
  const res = await Order.aggregate([
    { $match: { paymentStatus: { $in: ["paid", "refunded"] } } },
    {
      $group: {
        _id: {
          hour: { $hour: "$createdAt" },
          dayOfWeek: { $dayOfWeek: "$createdAt" },
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
    { $sort: { orders: -1 } },
    { $limit: 5 }
  ]);
  
  console.log("PeakOrders:", JSON.stringify(res, null, 2));
  process.exit(0);
}

test().catch(console.error);
