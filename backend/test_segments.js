import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from './tracker/models.js';
import UserProfile from './profile/models.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
  
  const allSpend = await Order.aggregate([
    {
      $group: {
        _id: '$user',
        totalSpendAll: { $sum: '$totalAmount' },
        totalSpendPaid: { 
          $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0] } 
        },
        totalSpendValid: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ["$paymentStatus", "paid"] },
                { $ne: ["$orderStatus", "cancelled"] }
              ]},
              "$totalAmount",
              0
            ]
          }
        }
      }
    },
    { $sort: { totalSpendAll: -1 } }
  ]);
  
  for (let s of allSpend) {
    const user = await UserProfile.findById(s._id, 'name email');
    console.log(`${user?.name} - All: ${s.totalSpendAll}, Paid: ${s.totalSpendPaid}, Valid: ${s.totalSpendValid}`);
  }

  process.exit(0);
}

run().catch(console.error);
