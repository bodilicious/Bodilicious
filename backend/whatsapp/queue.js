import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

// Create connection using the existing Redis URL
const connection = {
  url: process.env.REDIS_URL,
};

export const whatsappQueue = new Queue("whatsappQueue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 200, // as requested
  },
});

export const enqueueWhatsApp = async (jobName, data, options = {}) => {
  try {
    await whatsappQueue.add(jobName, data, options);
    console.log(`[WhatsApp Queue] Enqueued job: ${jobName}`);
  } catch (err) {
    console.error(`[WhatsApp Queue] Error enqueueing ${jobName}:`, err.message);
  }
};
