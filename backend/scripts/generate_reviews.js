import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../products/models.js';
import UserProfile from '../profile/models.js';

dotenv.config();

const TAMIL_NAMES = [
    'Anbu Selvan', 'Iniyan Mani', 'Kavin Raj', 'Madhi Kumaran', 'Pugazh Mani', 
    'Selvi Rani', 'Tamizh Mani', 'Kayal Vizhi', 'Yazhini Devi', 'Oviya Selvan',
    'Arul Jothi', 'Mani Vel', 'Velu Mani', 'Devi Priya', 'Ponni Arul'
];

const TELUGU_NAMES = [
    'Arjun Rao', 'Karthik Reddy', 'Sai Teja', 'Teja Mani', 'Vishnu Vardhan', 
    'Ananya Rao', 'Deepthi Reddy', 'Harika Rao', 'Kavya Mani', 'Pallavi Reddy',
    'Ravi Kumar', 'Suman Rao', 'Bhanu Teja', 'Siri Mani', 'Jyothi Rao'
];

const SKIN_COMMENTS = [
    "Amazing glow! My skin has never looked better.",
    "Helped my acne so much. Truly a lifesaver.",
    "Feels very luxury on the skin. Love the texture.",
    "My skin feels so soft and supple after using this.",
    "Best serum I've used so far. Highly recommended.",
    "Highly recommend for anyone with oily skin.",
    "Visible results in just a week! I'm impressed.",
    "So hydrating and doesn't feel heavy at all.",
    "The ingredients are top-notch. Can feel the quality.",
    "Perfect for my sensitive skin. No irritation at all."
];

const HAIR_COMMENTS = [
    "My hair feels so strong and healthy.",
    "Reduced my hair fall significantly. Great product!",
    "Smells wonderful! Lon-lasting fragrance.",
    "Best shampoo for frizz-prone hair. Works like magic.",
    "Scalp feels so clean and refreshed after every wash.",
    "Noticeable shine after just a few uses.",
    "Great for dry and damaged hair. Very nourishing.",
    "Love the natural ingredients. Will buy again.",
    "Makes my hair so soft and manageable.",
    "The best hair treatment I've tried in a long time."
];

const BODY_COMMENTS = [
    "Very refreshing and leaves a great scent.",
    "Love the fragrance! It's so soothing.",
    "Skin feels moisturized all day long.",
    "A must-have body wash for daily use.",
    "Gentle on skin yet very effective.",
    "Great luxury feel at an affordable price.",
    "The fragrance is just divine. Highly recommend.",
    "Best body scrub I've ever used. Skin feels like silk.",
    "Really helps with dry patches on my arms.",
    "Feels like a spa experience every morning."
];

const OTHER_COMMENTS = [
    "Perfect addition to my beauty routine.",
    "High quality product with great results.",
    "Love the brand and its commitment to quality.",
    "The packaging is beautiful and the product is even better.",
    "Exceeded my expectations. Will definitely repurchase.",
    "A bit pricey but totally worth every penny.",
    "The results speak for themselves. Simply amazing.",
    "I've tried many products, but this is the best one.",
    "Gentle, effective, and smells great.",
    "Highly recommend to all my friends and family."
];

async function generateReviews() {
    try {
        const uri = process.env.MONGO_URI.endsWith('/') ? process.env.MONGO_URI + process.env.DB_NAME : process.env.MONGO_URI + '/' + process.env.DB_NAME;
        await mongoose.connect(uri || 'mongodb://localhost:27017/bodilicious');
        console.log("Connected to database:", mongoose.connection.name);

        const allNames = [...TAMIL_NAMES, ...TELUGU_NAMES];
        const users = [];

        console.log("Ensuring mock users exist...");
        for (const name of allNames) {
            let user = await UserProfile.findOne({ name });
            if (!user) {
                user = await UserProfile.create({
                    firebaseUID: `mock-${name.toLowerCase().replace(/\s+/g, '-')}`,
                    name,
                    email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                    isActive: true
                });
            }
            users.push(user);
        }
        console.log(`${users.length} mock users ready.`);

        const products = await Product.find({ isActive: true });
        console.log(`Found ${products.length} active products.`);

        for (const product of products) {
            console.log(`Generating reviews for: ${product.name}`);
            
            // Generate exactly 4 reviews
            const productReviews = [];
            const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
            const selectedUsers = shuffledUsers.slice(0, 4);

            for (let i = 0; i < 4; i++) {
                const user = selectedUsers[i];
                // Rating distribution: 75% are 4s, 25% are 5s (to satisfy "a lot of 4s and a little 5")
                const rating = Math.random() < 0.75 ? 4 : 5;
                
                let commentTemplates = OTHER_COMMENTS;
                if (product.category === 'skin') commentTemplates = SKIN_COMMENTS;
                else if (product.category === 'hair') commentTemplates = HAIR_COMMENTS;
                else if (product.category === 'body') commentTemplates = BODY_COMMENTS;

                const comment = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];

                productReviews.push({
                    user: user._id,
                    rating,
                    comment
                });
            }

            product.reviews = productReviews;
            product.calculateRatings();
            await product.save();
        }

        console.log("All products updated with ratings and reviews.");

    } catch (err) {
        console.error("Error in generateReviews:", err);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed.");
    }
}

generateReviews();
