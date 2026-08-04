import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import UserProfile from './profile/models.js';
import Order from './tracker/models.js';

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const user = await UserProfile.findOne({ email: 'jacksonraj0711@gmail.com' });
    let userId = user ? user._id : null;
    
    let orders = [];
    if (userId) {
      orders = await Order.find({ user: userId });
      console.log('Found ' + orders.length + ' orders for ' + user.email);
    }
    
    const guestOrders = await Order.find({ 
      "shippingDetails.email": "jacksonraj0711@gmail.com", 
      user: { $ne: userId } 
    });
    console.log('Found ' + guestOrders.length + ' guest orders for email jacksonraj0711@gmail.com');

    const allOrders = [...orders, ...guestOrders];
    
    if (allOrders.length > 0) {
      console.log('\n--- DRY RUN: Orders to be deleted ---');
      allOrders.forEach(o => {
        console.log('- ID: ' + o._id + ', Status: ' + o.orderStatus + ', Amount: ' + o.totalAmount + ', Created: ' + o.createdAt);
      });
      console.log('--- END DRY RUN ---');
      console.log('\nThis is a dry run. No data was actually deleted.');
    } else {
      console.log('No orders found to delete.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
