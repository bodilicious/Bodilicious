const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const duplicates = await mongoose.connection.collection('orders').aggregate([
    { $match: { razorpayOrderId: { $exists: true, $ne: null } } },
    { $group: { _id: '$razorpayOrderId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  console.log('Duplicates:', JSON.stringify(duplicates, null, 2));
  process.exit(0);
}).catch(console.error);
