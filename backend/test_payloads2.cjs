const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME }).then(async () => {
  const UserProfile = require('./profile/models.js').default;
  const Order = require('./tracker/models.js').default;
  const AuditLog = require('./audit/models.js').default;
  const FAQ = require('./support/models.js').default;
  
  const models = [
    { name: 'UserProfile', model: UserProfile },
    { name: 'Order', model: Order },
    { name: 'AuditLog', model: AuditLog },
    { name: 'FAQ', model: FAQ }
  ];
  
  for (const m of models) {
    const docs = await m.model.find({}).lean().limit(100); // Sample up to 100
    let size = JSON.stringify(docs).length;
    console.log(`${m.name} size (100 max): ${(size / 1024 / 1024).toFixed(3)} MB`);
  }
  mongoose.connection.close();
});
