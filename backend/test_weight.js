import "dotenv/config";
import mongoose from "mongoose";
import Product from "./products/models.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const product = new Product({
      pid: "TEST-WEIGHT",
      name: "Test Weight Product",
      price: 100,
      description: "Test description",
      product_weight_g: 15,
      images: ["https://example.com/img.jpg"],
      category: "skin"
    });
    await product.save();
    console.log("Product saved successfully with weight 15g");
    
    // Cleanup
    await Product.deleteOne({ pid: "TEST-WEIGHT" });
    console.log("Test product deleted");
  } catch (err) {
    console.error("Failed to save product:", err);
  }
  await mongoose.disconnect();
}

run();
