const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME }).then(async () => {
  const Product = require('./products/models.js').default;
  const count = await Product.countDocuments({ images: { $regex: /^data:image/ } });
  console.log('Base64 images count:', count);
  mongoose.connection.close();
});
