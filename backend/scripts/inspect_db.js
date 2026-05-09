import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function inspectCollections() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.DB_NAME,
        });

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Database Collections:", collections.map(c => c.name));

        const searchTerms = [/Bass/i, /Audio/i, /Speaker/i, /Lorem/i, /Discription/i];

        for (const coll of collections) {
            const dbColl = mongoose.connection.db.collection(coll.name);
            const docs = await dbColl.find({}).toArray();
            
            for (const doc of docs) {
                const docStr = JSON.stringify(doc);
                for (const term of searchTerms) {
                    if (term.test(docStr)) {
                        console.log(`[MATCH FOUND] Collection: ${coll.name}, ID: ${doc._id || 'N/A'}`);
                        console.log(JSON.stringify(doc, null, 2).slice(0, 500) + "...\n");
                    }
                }
            }
        }

        console.log("Inspection complete.");
        process.exit(0);
    } catch (err) {
        console.error("Inspection failed:", err);
        process.exit(1);
    }
}

inspectCollections();
