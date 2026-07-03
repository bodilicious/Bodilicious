import { Queue } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

async function checkQueue() {
  if (!process.env.REDIS_URL) return console.log("No redis URL");
  const connection = new Redis(process.env.REDIS_URL);
  const queue = new Queue('auditQueue', { connection });
  
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const delayed = await queue.getDelayedCount();
  
  console.log(`Waiting: ${waiting}, Active: ${active}, Delayed: ${delayed}`);
  process.exit(0);
}
checkQueue();
