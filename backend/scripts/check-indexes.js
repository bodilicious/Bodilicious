import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const init = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 3,  dbName: process.env.DB_NAME });
        console.log("Connected to MongoDB");
        
        const indexes = await mongoose.connection.db.collection('userprofiles').indexes();
        console.log("Indexes for userprofiles:");
        console.log(JSON.stringify(indexes, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}
init();
