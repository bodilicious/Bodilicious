import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function getProducts() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
  const db = mongoose.connection.useDb(process.env.DB_NAME);
  const products = await db.collection('products').find({}).toArray();
  products.forEach((p, i) => console.log(`${i+1}. ${p.name} (PID: ${p.pid})`));
  console.log(`Total products: ${products.length}`);
  mongoose.disconnect();
}
getProducts();
