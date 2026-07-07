const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function checkRetroactiveGaps() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
  const Product = require('./products/models.js').default;

  const longDescriptions = await Product.countDocuments({
    $expr: { $gt: [{ $strLenCP: "$description" }, 5000] }
  });

  const tooManyImages = await Product.countDocuments({
    $expr: { $gt: [{ $size: "$images" }, 15] }
  });

  // For subdocuments, we can use an aggregation pipeline or just $elemMatch if available, 
  // but $expr doesn't easily map over arrays unless we unwind. Let's just pull products that have reviews and check locally.
  const productsWithReviews = await Product.find({ 'reviews.0': { $exists: true } }, 'reviews').lean();
  
  let longReviews = 0;
  for(const p of productsWithReviews) {
    if(p.reviews) {
      for(const r of p.reviews) {
        if(r.comment && r.comment.length > 1000) {
          longReviews++;
        }
      }
    }
  }

  console.log('--- Retroactive Gap Check ---');
  console.log(`Products with description > 5000 chars: ${longDescriptions}`);
  console.log(`Products with > 15 images: ${tooManyImages}`);
  console.log(`Reviews with comment > 1000 chars: ${longReviews}`);

  process.exit(0);
}

checkRetroactiveGaps().catch(console.error);
