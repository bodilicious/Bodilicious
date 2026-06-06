import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function generateReport() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME || 'myappdb';
        if (!mongoUri) {
            throw new Error('MONGO_URI not found in .env');
        }

        await mongoose.connect(mongoUri, { maxPoolSize: 3,  dbName });
        console.log('Connected to MongoDB:', dbName);

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name).join(', '));

        const products = await Product.find({ isActive: true }).lean();
        
        const report = products.map(p => ({
            pid: p.pid,
            name: p.name,
            category: p.category,
            sub_category: p.sub_category,
            price: p.price,
            price_inr: p.price_inr,
            stock: p.stock,
            availability: p.availability,
            rating: p.rating,
            ratingCount: p.ratingCount,
            lowStockThreshold: p.lowStockThreshold || 5
        }));

        console.log('REPORT_DATA_START');
        console.log(JSON.stringify(report, null, 2));
        console.log('REPORT_DATA_END');

    } catch (err) {
        console.error('Error generating report:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

generateReport();
