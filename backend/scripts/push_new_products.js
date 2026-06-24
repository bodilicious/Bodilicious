import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../products/models.js';

dotenv.config({ path: '../.env' }); // Adjust if .env is elsewhere, but usually process.env is populated or dotenv finds it. Wait, seed.js just does dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function convertEJSON(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(convertEJSON);
    if (obj.$oid) return new mongoose.Types.ObjectId(obj.$oid);
    if (obj.$date) return new Date(obj.$date);
    const newObj = {};
    for (const key in obj) {
        newObj[key] = convertEJSON(obj[key]);
    }
    return newObj;
}

async function run() {
    // try to load dotenv again just in case it's in the parent dir
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
    
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bodilicious';
    const dbName = process.env.DB_NAME || 'bodilicious';

    await mongoose.connect(uri, { dbName });
    console.log("Connected to MongoDB.");

    const productsPath = path.join(__dirname, 'myappdb.products.json');
    const rawJson = fs.readFileSync(productsPath, 'utf-8');
    const productsData = JSON.parse(rawJson);

    console.log(`Loaded ${productsData.length} products from JSON file.`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const productData of productsData) {
        const existingProduct = await Product.findOne({ pid: productData.pid });
        
        if (existingProduct) {
            console.log(`Skipping existing product: ${productData.pid} - ${productData.name}`);
            skippedCount++;
        } else {
            console.log(`Inserting new product: ${productData.pid} - ${productData.name}`);
            const cleanedData = convertEJSON(productData);
            
            // To avoid duplicate key errors on _id, we can either keep the existing _id or delete it
            // We'll keep it as the cleanup converted it to ObjectId.
            // But if it causes issues, we can remove it so mongoose generates a new one.
            // Let's remove _id to be safe, unless we want to preserve exact _id.
            // The prompt says "just push the ones that didnt exist", so we'll push the whole thing.
            
            try {
                await Product.create(cleanedData);
                insertedCount++;
            } catch (err) {
                console.error(`Error inserting ${productData.pid}:`, err.message);
            }
        }
    }

    console.log(`\nDone. Inserted: ${insertedCount}, Skipped: ${skippedCount}`);
    await mongoose.connection.close();
}

run().catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
});
