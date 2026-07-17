const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME }).then(async () => {
  const Product = require('./products/models.js').default;
  const docs = await Product.find({}).select('pid name reviews').slice('reviews', -2).limit(2).lean();
  console.log(JSON.stringify(docs, null, 2));
  mongoose.connection.close();
});
