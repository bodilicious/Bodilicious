const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function testExtreme() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
  const Product = require('./products/models.js').default;

  // Get a single full product
  const product = await Product.findOne().lean();
  
  if(!product) {
    console.log("No product found");
    process.exit(1);
  }

  // Create a massive review exactly matching the new 1000 char limit
  const massiveReview = {
    rating: 5,
    comment: "A".repeat(1000), // Exactly 1000 chars
    isVerified: true,
    createdAt: new Date(),
    user: { name: "Test User Who Has A Very Long Name" }
  };

  // Pad the reviews array to exactly 30 massive reviews
  const paddedReviews = [];
  for(let i=0; i<30; i++) {
    paddedReviews.push({...massiveReview});
  }

  // Assign padded reviews and pad description to exactly 5000 chars
  product.reviews = paddedReviews;
  product.description = "B".repeat(5000);
  
  // Create 15 images (new max limit)
  product.images = [];
  for(let i=0; i<15; i++) {
    product.images.push("https://example.com/very/long/path/to/an/image/that/takes/up/space/image" + i + ".jpg");
  }

  // Map the product like the controller does
  const transformedProduct = {
    ...product,
    reviews: product.reviews.map(r => ({
      rating: r.rating,
      comment: r.comment,
      isVerified: !!r.isVerified,
      createdAt: r.createdAt,
      user: r.user?.name || "Customer"
    }))
  };

  // Clone to 100 products
  const hundredProducts = [];
  for(let i=0; i<100; i++) {
    hundredProducts.push(transformedProduct);
  }

  const payload = {
    products: hundredProducts,
    page: 1,
    pages: 1,
    total: 100
  };

  const jsonString = JSON.stringify(payload);
  const sizeMB = (Buffer.byteLength(jsonString, 'utf8') / 1024 / 1024).toFixed(3);
  
  console.log(`- Simulated Products: ${hundredProducts.length}`);
  console.log(`- Reviews per Product: ${paddedReviews.length}`);
  console.log(`- Total Reviews Embedded: ${hundredProducts.length * paddedReviews.length}`);
  console.log(`- Absolute Worst-Case Payload Size (Enforced Max-Lengths): ${sizeMB} MB`);

  process.exit(0);
}

testExtreme().catch(console.error);
