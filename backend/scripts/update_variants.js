import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../products/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function run() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bodilicious';
    const dbName = process.env.DB_NAME || 'bodilicious';

    await mongoose.connect(uri, { dbName });
    console.log("Connected to MongoDB.");

    try {
        const res = await Product.updateOne(
            { pid: 'BD-FOUND-FRESH' },
            { $set: { variants: ['Fair Skin', 'Bold Skin', 'Medium Skin'] } }
        );
        console.log('Update result:', res);
    } catch (err) {
        console.error('Error updating:', err.message);
    }

    await mongoose.connection.close();
}

run().catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
});
