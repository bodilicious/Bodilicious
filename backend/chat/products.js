import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Product from "../products/models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const getProducts = async () => {
    try {
        const products = await Product.find({ isActive: true }).lean();
        return products;
    } catch (err) {
        console.error("Error fetching products for chat:", err);
        return [];
    }
};