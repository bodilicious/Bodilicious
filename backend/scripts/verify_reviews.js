import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../products/models.js';
import UserProfile from '../profile/models.js';

dotenv.config();

async function verifyReviews() {
    try {
        const uri = process.env.MONGO_URI.endsWith('/') ? process.env.MONGO_URI + process.env.DB_NAME : process.env.MONGO_URI + '/' + process.env.DB_NAME;
        await mongoose.connect(uri || 'mongodb://localhost:27017/bodilicious');

        const products = await Product.find({ isActive: true }).populate('reviews.user', 'name');
        
        let total4s = 0;
        let total5s = 0;
        let allValid = true;

        for (const product of products) {
            if (product.reviews.length !== 4) {
                console.error(`Product ${product.name} has ${product.reviews.length} reviews instead of 4.`);
                allValid = false;
            }

            if (product.rating <= 3.5) {
                console.error(`Product ${product.name} has a rating of ${product.rating} (<= 3.5).`);
                allValid = false;
            }

            for (const review of product.reviews) {
                if (review.rating === 4) total4s++;
                else if (review.rating === 5) total5s++;
                
                if (!review.user || !review.user.name) {
                   // console.warn(`Product ${product.name} has a review with missing user name.`);
                }
            }
        }

        console.log(`Verification Summary:`);
        console.log(`Total Products checked: ${products.length}`);
        console.log(`Total 4-star ratings: ${total4s}`);
        console.log(`Total 5-star ratings: ${total5s}`);
        console.log(`Ratio of 4s to 5s: ${(total4s / (total4s + total5s) * 100).toFixed(2)}% 4s`);
        
        if (allValid) {
            console.log("SUCCESS: All products meet the criteria (4 reviews, rating > 3.5).");
        } else {
            console.log("FAILURE: Some products do not meet the criteria.");
        }

    } catch (err) {
        console.error("Error in verifyReviews:", err);
    } finally {
        await mongoose.connection.close();
    }
}

verifyReviews();
