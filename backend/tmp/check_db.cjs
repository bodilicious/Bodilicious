const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'c:/Users/admin/Desktop/Bodilicious/backend/.env' });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

async function checkData() {
  try {
    const fullUri = MONGO_URI.endsWith('/') ? MONGO_URI + DB_NAME : MONGO_URI + '/' + DB_NAME;
    await mongoose.connect(fullUri);
    
    // Using dynamic models to avoid schema issues
    const orders = await mongoose.connection.db.collection('orders').countDocuments();
    const users = await mongoose.connection.db.collection('userprofiles').countDocuments();
    const products = await mongoose.connection.db.collection('products').countDocuments();
    const logs = await mongoose.connection.db.collection('auditlogs').countDocuments();
    
    console.log('Orders:', orders);
    console.log('Users:', users);
    console.log('Products:', products);
    console.log('AuditLogs:', logs);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.connection.close();
  }
}

checkData();
