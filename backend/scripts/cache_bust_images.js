import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const ProductSchema = new mongoose.Schema({ images: [String] }, { strict: false });
const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

async function run() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  const DB_NAME = process.env.DB_NAME || 'myappdb';
  
  await mongoose.connect(MONGO_URI, { maxPoolSize: 3,  dbName: DB_NAME });
  console.log('✅ Connected to MongoDB');

  const products = await Product.find({});
  console.log(`📦 Processing ${products.length} products...`);

  const version = new Date().getTime(); // Use timestamp as version
  let updatedCount = 0;

  for (const product of products) {
    if (!product.images || product.images.length === 0) continue;

    const newImages = product.images.map(img => {
      // Remove existing version if any and add new one
      const baseUrl = img.split('?')[0];
      return `${baseUrl}?v=${version}`;
    });

    product.images = newImages;
    await product.save();
    updatedCount++;
  }

  console.log(`✅ Successfully updated ${updatedCount} products with version v=${version}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
