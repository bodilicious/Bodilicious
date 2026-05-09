import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

const init = async () => {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    const count = await Product.countDocuments();
    const activeCount = await Product.countDocuments({ isActive: true });
    console.log(`Total DB items: ${count}`);
    console.log(`Active DB items: ${activeCount}`);
    process.exit(0);
}
init();
