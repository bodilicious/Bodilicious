import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const Schema = mongoose.Schema;
const ProductSchema = new Schema({}, { strict: false });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function checkRoseProducts() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bodilicious', { maxPoolSize: 3,  maxPoolSize: 3 });
        const products = await Product.find({ 
            isActive: true, 
            $or: [
                { name: /rose/i }, 
                { description: /rose/i }, 
                { 'ingredients.botanical_extracts': /rose/i },
                { 'ingredients.key_actives': /rose/i }
            ] 
        });
        console.log(JSON.stringify(products.map(p => ({ 
            name: p.name, 
            pid: p.pid, 
            skin_type_suitable: p.skin_type_suitable,
            description: p.description.substring(0, 50)
        })), null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

checkRoseProducts();
