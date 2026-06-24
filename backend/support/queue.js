import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

// Reuse the same Redis connection URL as whatsapp/queue.js
const connection = {
  url: process.env.REDIS_URL,
};

export const supportQueue = new Queue("support_jobs", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: true,
    removeOnFail: 200,
  },
});

export const enqueueTicketLookup = async (ticketId, type, orderId) => {
  try {
    if (!process.env.REDIS_URL) {
      console.warn("[Support Queue] REDIS_URL not set, skipping enqueue.");
      return;
    }
    // Deterministic jobId to prevent double processing on double clicks
    await supportQueue.add(
      "ticket_lookup",
      { ticketId, type, orderId },
      { jobId: `lookup-${ticketId}` }
    );
    console.log(`[Support Queue] Enqueued lookup for ticket: ${ticketId}`);
  } catch (err) {
    console.error(`[Support Queue] Error enqueueing lookup for ${ticketId}:`, err.message);
  }
};
