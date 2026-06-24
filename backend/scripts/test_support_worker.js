import mongoose from "mongoose";
import dotenv from "dotenv";
import { Ticket } from "../support/models.js";
import Order from "../tracker/models.js";
import { processLookup } from "../support/worker.js";
import UserProfile from "../profile/models.js";

dotenv.config();

const runTests = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB for tests.");

    // Setup mock data
    const user1 = new UserProfile({
      firebaseUID: `test-uid-${Date.now()}`,
      email: `test1-${Date.now()}@example.com`,
      name: "Test User 1"
    });
    await user1.save();

    const user2 = new UserProfile({
      firebaseUID: `test-uid-2-${Date.now()}`,
      email: `test2-${Date.now()}@example.com`,
      name: "Test User 2"
    });
    await user2.save();

    const order = new Order({
      user: user2._id, // Order belongs to user2
      items: [],
      originalAmount: 100,
      totalAmount: 100,
      paymentMethod: "cod",
      orderStatus: "shipped",
      shipmentId: "12345",
      shippingDetails: {
        name: "Test User 2",
        address: "123 Test St",
        city: "Test",
        state: "Test",
        pincode: "123456",
        phone: "1234567890"
      }
    });
    await order.save();

    const ticket = new Ticket({
      userId: user1._id, // Ticket created by user1
      type: "shipping",
      description: "Where is my order?",
      messages: [],
      orderId: order._id.toString()
    });
    await ticket.save();

    console.log("--- Test 1: Mismatched orderId Security Check ---");
    const job1 = { data: { ticketId: ticket._id.toString(), type: "shipping", orderId: order._id.toString() } };
    await processLookup(job1);

    const updatedTicket1 = await Ticket.findById(ticket._id);
    const lastMsg = updatedTicket1.messages[updatedTicket1.messages.length - 1];
    
    if (lastMsg && lastMsg.text.includes("blocked") && lastMsg.visibleToCustomer === false) {
      console.log("✅ Test 1 Passed: Order mismatch successfully blocked and logged as internal-only note.");
    } else {
      console.error("❌ Test 1 Failed: Order mismatch was not correctly blocked.");
    }

    console.log("--- Test 2: Idempotency (Duplicate Job Processing) ---");
    // Make order belong to user1 to pass security check
    order.user = user1._id;
    await order.save();

    // Reset messages for test
    ticket.messages = [];
    await ticket.save();

    // Process first time
    await processLookup(job1);
    
    const updatedTicket2 = await Ticket.findById(ticket._id);
    const msgCount1 = updatedTicket2.messages.length;
    console.log(`Ticket now has ${msgCount1} messages.`);

    // Process second time
    await processLookup(job1);

    const updatedTicket3 = await Ticket.findById(ticket._id);
    const msgCount2 = updatedTicket3.messages.length;
    
    if (msgCount1 === 1 && msgCount2 === 1) {
      console.log("✅ Test 2 Passed: Duplicate job processing was ignored correctly.");
    } else {
      console.error(`❌ Test 2 Failed: Expected 1 message, found ${msgCount2}.`);
    }

    // Cleanup
    await UserProfile.findByIdAndDelete(user1._id);
    await UserProfile.findByIdAndDelete(user2._id);
    await Order.findByIdAndDelete(order._id);
    await Ticket.findByIdAndDelete(ticket._id);

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

runTests();
