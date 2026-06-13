import dotenv from 'dotenv';
import mongoose from 'mongoose';
import UserProfile from './profile/models.js';
import { computeSegmentsForUsers } from './admin/segmentController.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
  console.log("Connected to DB, recomputing segments for all users...");
  
  const users = await UserProfile.find({}, '_id').lean();
  const userIds = users.map(u => u._id);
  
  // Chunking to avoid memory issues
  const chunkSize = 100;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    await computeSegmentsForUsers(chunk);
    console.log(`Processed ${i + chunk.length} / ${userIds.length}`);
  }

  console.log("Done!");
  process.exit(0);
}

run().catch(console.error);
