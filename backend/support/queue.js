import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

// Reuse the same Redis connection URL as whatsapp/queue.js
export const supportQueue = process.env.REDIS_URL
  ? new Queue("support_jobs", {
      connection: { url: process.env.REDIS_URL },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: 200,
      },
    })
  : null;

export const enqueueTicketLookup = async (ticketId, type, orderId) => {
  try {
    if (!supportQueue || !process.env.REDIS_URL) {
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
