import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

// Create connection using the existing Redis URL
export const whatsappQueue = process.env.REDIS_URL
  ? new Queue("whatsappQueue", {
      connection: { url: process.env.REDIS_URL },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 200,
      },
    })
  : null;

export const enqueueWhatsApp = async (jobName, data, options = {}) => {
  try {
    if (!whatsappQueue) {
      return;
    }
    await whatsappQueue.add(jobName, data, options);
    console.log(`[WhatsApp Queue] Enqueued job: ${jobName}`);
  } catch (err) {
    console.error(`[WhatsApp Queue] Error enqueueing ${jobName}:`, err.message);
  }
};
