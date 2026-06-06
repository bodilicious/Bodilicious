import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const Schema = mongoose.Schema;
const ProductSchema = new Schema({}, { strict: false });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function checkAllProducts() {
    try {
        const uri = process.env.MONGO_URI.endsWith('/') ? process.env.MONGO_URI + process.env.DB_NAME : process.env.MONGO_URI + '/' + process.env.DB_NAME;
        await mongoose.connect(uri || 'mongodb://localhost:27017/bodilicious');
        const products = await Product.find({}, { maxPoolSize: 3,  maxPoolSize: 3 });
        console.log(JSON.stringify(products.map(p => ({ 
            name: p.name, 
            pid: p.pid, 
            category: p.category,
            price: p.price
        })), null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

checkAllProducts();
