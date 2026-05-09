const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'c:/Users/admin/Desktop/Bodilicious/backend/.env' });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

const userProfileSchema = new mongoose.Schema({
  email: String,
  role: String,
  isBlocked: Boolean
});

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

async function checkAdmin() {
  try {
    const fullUri = MONGO_URI.endsWith('/') ? MONGO_URI + DB_NAME : MONGO_URI + '/' + DB_NAME;
    await mongoose.connect(fullUri);
    console.log('Connected to MongoDB');

    const email = 'jacksonraj0711@gmail.com';
    const user = await UserProfile.findOne({ email: email.toLowerCase() });

    if (user) {
      console.log(`User: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log(`Blocked: ${user.isBlocked}`);
    } else {
      console.log(`User with email ${email} not found.`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.connection.close();
  }
}

checkAdmin();
