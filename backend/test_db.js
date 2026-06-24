import 'dotenv/config';
import mongoose from 'mongoose';
import UserProfile from './profile/models.js';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await UserProfile.find().limit(5);
    console.log('Users found:', users.length);
    for (let u of users) {
      console.log(u.email, u.role, u.addresses?.length);
    }
  } catch(err) {
    console.error('Crash:', err);
  } finally {
    mongoose.disconnect();
  }
}
run();
