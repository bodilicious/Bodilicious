import mongoose from "mongoose";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
if (!process.env.MONGO_URI) {
  dotenv.config({ path: resolve(process.cwd(), ".env") });
}

import "../profile/models.js";
import { syncCart } from "../profile/controller.js";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const UserProfile = mongoose.model("UserProfile");
  
  // Create a test user
  const user = await UserProfile.create({
    name: "Test Race",
    email: `test_race_${Date.now()}@example.com`,
    password: "hashedpassword123", // required field
    role: "user"
  });

  const pid = new mongoose.Types.ObjectId();

  // Mock req and res for syncCart
  const createMockReqRes = (newQty) => {
    const req = {
      user: { _id: user._id },
      body: {
        cartItems: [{ productId: pid.toString(), quantity: newQty }]
      },
      headers: {},
      ip: "127.0.0.1"
    };

    const res = {
      status: () => res,
      json: () => {}
    };
    return { req, res };
  };

  console.log("Firing 5 concurrent requests adding 1 quantity each...");
  
  // 5 concurrent requests
  // Request 1: qty = 1
  // Request 2: qty = 2
  // Request 3: qty = 3
  // Request 4: qty = 4
  // Request 5: qty = 5
  
  const promises = [];
  for (let i = 1; i <= 5; i++) {
    const { req, res } = createMockReqRes(i);
    promises.push(syncCart(req, res));
  }

  await Promise.all(promises);

  const updatedUser = await UserProfile.findById(user._id);
  const cartAdd = updatedUser.lifetimeCartAdds.find(a => a.product.toString() === pid.toString());

  console.log("Expected count: 5");
  console.log("Actual count:", cartAdd ? cartAdd.count : 0);

  if (cartAdd && cartAdd.count === 5) {
    console.log("✅ Race condition test passed! The $inc operator handled concurrency correctly.");
  } else {
    console.log("❌ Race condition test failed. Expected 5 but got", cartAdd ? cartAdd.count : 0);
  }

  // Cleanup
  await UserProfile.findByIdAndDelete(user._id);

  await mongoose.disconnect();
};

run().catch(console.error);
