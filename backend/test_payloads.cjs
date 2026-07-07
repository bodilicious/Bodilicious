const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME }).then(async () => {
  const Product = require('./products/models.js').default;
  const countDesc = await Product.countDocuments({ description: { $regex: /data:image/ } });
  console.log('Base64 in description count:', countDesc);
  
  const allProducts = await Product.find({}).lean();
  let totalSize = JSON.stringify(allProducts).length;
  console.log('Size of ALL products (no projection):', (totalSize / 1024 / 1024).toFixed(2), 'MB');
  
  const slimProducts = await Product.find({}, { pid: 1, name: 1, price: 1, images: 1, rating: 1, ratingCount: 1, stock: 1, category: 1, brand: 1, isActive: 1 }).lean();
  let totalSlimSize = JSON.stringify(slimProducts).length;
  console.log('Size of ALL products (slim projection):', (totalSlimSize / 1024 / 1024).toFixed(2), 'MB');
  
  const limit50 = allProducts.slice(0, 50);
  console.log('Size of 50 products (no projection):', (JSON.stringify(limit50).length / 1024).toFixed(2), 'KB');
  
  mongoose.connection.close();
});
