import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function estimateAuditData() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    
    const statsV2 = await db.command({ collStats: 'audit_logs_v2' }).catch(() => null);
    
    if (!statsV2) {
      console.log("Collection 'audit_logs_v2' not found or no stats available.");
      
      // Give a rough estimate based on the schema
      console.log("\nBased on the schema, an average audit log document is roughly 400 - 600 bytes.");
      console.log("If you average 1,000 events per day:");
      console.log("  1 Day: ~0.5 MB");
      console.log("  1 Month: ~15 MB");
      console.log("  1 Year: ~180 MB");
      
    } else {
      console.log("--- Audit Logs V2 Stats ---");
      console.log(`Document Count: ${statsV2.count}`);
      console.log(`Average Document Size: ${statsV2.avgObjSize} bytes`);
      console.log(`Total Size: ${(statsV2.size / 1024 / 1024).toFixed(2)} MB`);
      
      if (statsV2.count > 0) {
        const avgSize = statsV2.avgObjSize;
        console.log(`\n--- Estimated Size Per Year ---`);
        console.log(`If 1,000 events/day (365k/year): ${((avgSize * 365000) / 1024 / 1024).toFixed(2)} MB per year`);
        console.log(`If 10,000 events/day (3.65m/year): ${((avgSize * 3650000) / 1024 / 1024).toFixed(2)} MB per year`);
        console.log(`If 100,000 events/day (36.5m/year): ${((avgSize * 36500000) / 1024 / 1024).toFixed(2)} MB per year`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

estimateAuditData();
