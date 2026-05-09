import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../products/models.js';

dotenv.config();

mongoose
    .connect(process.env.MONGO_URI, {
        dbName: process.env.DB_NAME,
    })
    .then(async () => {
        console.log("MongoDB connected for migration");

        // Use lean() to get raw JSON documents as they exist in the DB
        const products = await Product.collection.find({}).toArray();
        console.log(`Found ${products.length} products to check for migration.`);

        let migratedCount = 0;

        for (const p of products) {
            let needsUpdate = false;
            let setPayload = {};
            let unsetPayload = {};

            // Migrate 'type' to 'category'
            if (p.type && !p.category) {
                setPayload.category = p.type;
                unsetPayload.type = "";
                needsUpdate = true;
            }

            // Migrate 'uses' to 'benefits'
            if (p.uses && p.uses.length > 0) {
                setPayload.benefits = p.uses;
                unsetPayload.uses = "";
                needsUpdate = true;
            }

            // Migrate 'symptomsCured' to 'concerns_targeted'
            if (p.symptomsCured && p.symptomsCured.length > 0) {
                setPayload.concerns_targeted = p.symptomsCured;
                unsetPayload.symptomsCured = "";
                needsUpdate = true;
            }

            // Migrate 'ingredients' array to object format
            if (Array.isArray(p.ingredients) && p.ingredients.length > 0 && typeof p.ingredients[0] === 'string') {
                setPayload.ingredients = {
                    key_actives: [],
                    botanical_extracts: [],
                    others: p.ingredients
                };
                needsUpdate = true;
            }

            if (needsUpdate) {
                const updateQuery = {};
                if (Object.keys(setPayload).length > 0) updateQuery.$set = setPayload;
                if (Object.keys(unsetPayload).length > 0) updateQuery.$unset = unsetPayload;

                await Product.collection.updateOne(
                    { _id: p._id },
                    updateQuery
                );
                migratedCount++;
            }
        }

        console.log(`Successfully migrated ${migratedCount} products to the new schema format.`);
        process.exit(0);
    })
    .catch((err) => {
        console.error("Migration Failed!", err);
        process.exit(1);
    });
