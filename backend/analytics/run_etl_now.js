import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runETL } from './etl.js';

dotenv.config({ path: '../.env' });

async function manualRun() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for manual ETL run');
    await runETL();
    console.log('ETL complete');
  } catch (err) {
    console.error('Error running ETL:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

manualRun();
