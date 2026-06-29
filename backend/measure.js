import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const measureSize = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    const [products, settings, homepageContent, tickets] = await Promise.all([
      db.collection('products').find({}).toArray(),
      db.collection('storesettings').findOne({}),
      db.collection('homepagecontents').findOne({}),
      db.collection('supporttickets').find({}).limit(10).toArray() // Average ticket size
    ]);

    // calculate unique filters size (similar to what backend does)
    const filters = {
      categories: [...new Set(products.map(p => p.category).filter(Boolean))],
      subCategories: [...new Set(products.map(p => p.subCategory).filter(Boolean))],
      productTypes: [...new Set(products.map(p => p.type).filter(Boolean))],
      concerns: [...new Set(products.flatMap(p => p.concerns || []).filter(Boolean))],
      ingredients: [...new Set(products.flatMap(p => p.ingredients || []).filter(Boolean))],
    };

    const filtersSize = Buffer.byteLength(JSON.stringify({ success: true, data: filters }));
    const settingsSize = Buffer.byteLength(JSON.stringify({ success: true, data: settings || {} }));
    const homepageSize = Buffer.byteLength(JSON.stringify({ success: true, data: homepageContent || {} }));
    
    // Average ticket size for the user payload
    const ticketSize = tickets.length > 0 ? Buffer.byteLength(JSON.stringify({ success: true, tickets })) / tickets.length : 0;

    console.log(JSON.stringify({
      filtersSize,
      settingsSize,
      homepageSize,
      ticketAvgSize: ticketSize
    }, null, 2));

  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
  }
};

measureSize();
