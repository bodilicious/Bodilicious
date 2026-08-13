import mongoose from 'mongoose';
import UserProfile from './profile/models.js';
import Order from './tracker/models.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find a user or create one
    let user = await UserProfile.findOne({});
    if (!user) {
        console.log("No users found");
        process.exit(1);
    }
    
    // Add dummy cart items
    user.cart = [
        { product: new mongoose.Types.ObjectId(), variant: "A", quantity: 1 },
        { product: new mongoose.Types.ObjectId(), variant: "B", quantity: 2 }
    ];
    await user.save();
    
    console.log("Original cart size:", user.cart.length);
    const cartItem = user.cart[0];
    console.log("Pulling product ID:", cartItem.product);
    
    const productIdsToRemove = [cartItem.product.toString()]; // Array of Strings
    
    await UserProfile.findByIdAndUpdate(user._id, {
        $pull: { cart: { product: { $in: productIdsToRemove } } }
    });
    
    const updated = await UserProfile.findById(user._id);
    console.log("New cart size:", updated.cart.length);
    if (updated.cart.length < user.cart.length) {
        console.log("Pull successful");
    } else {
        console.log("Pull FAILED");
    }
    
    process.exit(0);
}

run();
