import "dotenv/config";
import mongoose from "mongoose";
import { startWhatsAppWorker } from "./whatsapp/worker.js";
import { initAuditWorker } from "./audit/worker.js";

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME,
      maxPoolSize: 50,
    });
    console.log("[Worker] MongoDB connected");

    const whatsappWorker = startWhatsAppWorker();
    const auditWorker = initAuditWorker();

    const gracefulShutdown = async (signal) => {
      console.log(`\n[Worker] Received ${signal}. Starting graceful shutdown...`);
      try {
        if (whatsappWorker) await whatsappWorker.close();
        if (auditWorker) await auditWorker.close();
        
        await mongoose.connection.close();
        console.log("[Worker] MongoDB connection closed.");
        process.exit(0);
      } catch (err) {
        console.error("[Worker] Error during shutdown:", err.message);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  } catch (err) {
    console.error("[Worker] Startup failed:", err.message);
    process.exit(1);
  }
}

start();
