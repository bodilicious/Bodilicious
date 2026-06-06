import { sendOrderPlaced } from "./whatsapp/templates.js";

async function run() {
  console.log("Testing WhatsApp mock send...");
  try {
    await sendOrderPlaced("+919876543210", {
      name: "Test User",
      order_id: "ORD12345",
      amount: "₹1,999",
      edd: "3-5 business days"
    });
    console.log("Test completed successfully.");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

run();
