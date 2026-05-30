import cron from "node-cron";
import { v2 as cloudinary } from "cloudinary";
import { Ticket } from "./models.js";

/**
 * Cleanup job that runs every 24 hours at 3:00 AM
 * Identifies and deletes orphaned Cloudinary uploads in the support folder.
 */
export const initSupportCleanupCron = () => {
  cron.schedule("0 3 * * *", async () => {
    console.log("[Support Cleanup] Starting orphaned Cloudinary upload cleanup...");
    
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.log("[Support Cleanup] Cloudinary credentials missing. Skipping cleanup.");
      return;
    }

    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET 
    });

    try {
      // 1. Fetch all assets from the support folder in Cloudinary
      let nextCursor = null;
      const allCloudinaryPublicIds = new Set();
      
      do {
        const result = await cloudinary.search
          .expression('folder:bodilicious_support')
          .max_results(500)
          .next_cursor(nextCursor)
          .execute();
          
        result.resources.forEach(res => allCloudinaryPublicIds.add(res.public_id));
        nextCursor = result.next_cursor;
      } while (nextCursor);

      if (allCloudinaryPublicIds.size === 0) {
        console.log("[Support Cleanup] No support uploads found in Cloudinary.");
        return;
      }

      // 2. Fetch all publicIds used in Tickets
      const tickets = await Ticket.find({}, 'messages.attachments');
      const usedPublicIds = new Set();
      
      tickets.forEach(ticket => {
        ticket.messages.forEach(msg => {
          if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(att => {
              if (att.publicId) usedPublicIds.add(att.publicId);
            });
          }
        });
      });

      // 3. Find orphaned IDs (in Cloudinary but not in MongoDB)
      const orphanedIds = [];
      for (const id of allCloudinaryPublicIds) {
        if (!usedPublicIds.has(id)) {
          orphanedIds.push(id);
        }
      }

      console.log(`[Support Cleanup] Found ${orphanedIds.length} orphaned uploads out of ${allCloudinaryPublicIds.size} total.`);

      // 4. Delete orphaned IDs
      if (orphanedIds.length > 0) {
        // Cloudinary API supports deleting up to 100 resources at once
        const chunks = [];
        for (let i = 0; i < orphanedIds.length; i += 100) {
          chunks.push(orphanedIds.slice(i, i + 100));
        }

        for (const chunk of chunks) {
          await cloudinary.api.delete_resources(chunk);
          console.log(`[Support Cleanup] Deleted chunk of ${chunk.length} orphaned uploads.`);
        }
      }
      
      console.log("[Support Cleanup] Orphaned upload cleanup completed successfully.");
    } catch (err) {
      console.error("[Support Cleanup] Error during cleanup:", err);
    }
  });
};
