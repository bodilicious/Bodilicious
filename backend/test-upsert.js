import mongoose from 'mongoose';
import dotenv from 'dotenv';
import UserProfile from './profile/models.js';
dotenv.config();

const testUpsert = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 3,  dbName: process.env.DB_NAME });
        console.log("Connected to MongoDB");
        
        const testUid = "test_uid_" + Date.now();
        const testEmail = "test" + Date.now() + "@example.com";
        
        console.log("Attempting upsert for:", testUid);
        
        const user = await UserProfile.findOneAndUpdate(
            { firebaseUID: testUid },
            {
                $setOnInsert: {
                    firebaseUID: testUid,
                    name: "Test User",
                    email: testEmail,
                },
                $set: {
                    email: testEmail,
                    emailVerified: true,
                },
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                runValidators: true // Force validation
            }
        );
        
        console.log("Upsert successful:", user._id);
        
        // Test with empty string email (to see if validation fails)
        try {
            console.log("Testing with empty email...");
            await UserProfile.findOneAndUpdate(
                { firebaseUID: "test_empty_email" },
                {
                    $setOnInsert: {
                        firebaseUID: "test_empty_email",
                        name: "Empty Email User",
                        email: "",
                    },
                    $set: {
                        email: "",
                    },
                },
                { upsert: true, runValidators: true }
            );
            console.log("Upsert with empty email successful (unexpected)");
        } catch (err) {
            console.log("Upsert with empty email failed (expected):", err.message);
        }

        process.exit(0);
    } catch (err) {
        console.error("Main Test Failed:", err);
        process.exit(1);
    }
}
testUpsert();
