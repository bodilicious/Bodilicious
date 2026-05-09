import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

async function generateMarkdownReport() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME || 'myappdb';
        await mongoose.connect(mongoUri, { dbName });

        const products = await Product.find({ isActive: true }).lean();
        
        let md = '# Detailed Product Report - Admin Panel\n\n';
        md += `*Generated on: ${new Date().toLocaleString()}*\n\n`;

        // 1. Executive Summary
        md += '## 📊 Executive Summary\n';
        md += `- **Total Active Products:** ${products.length}\n`;
        
        const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        md += `- **Total Inventory Count:** ${totalStock}\n`;
        
        const lowStock = products.filter(p => (p.stock || 0) <= (p.lowStockThreshold || 5));
        md += `- **Low Stock Alerts:** ${lowStock.length}\n`;
        
        const outOfStock = products.filter(p => (p.stock || 0) === 0);
        md += `- **Out of Stock:** ${outOfStock.length}\n\n`;

        // 2. Category Distribution
        md += '## 🗂️ Category Distribution\n';
        const categories = {};
        products.forEach(p => {
            const cat = p.category || 'Uncategorized';
            categories[cat] = (categories[cat] || 0) + 1;
        });
        
        md += '| Category | Product Count |\n';
        md += '| :--- | :--- |\n';
        for (const [cat, count] of Object.entries(categories)) {
            md += `| ${cat.charAt(0).toUpperCase() + cat.slice(1)} | ${count} |\n`;
        }
        md += '\n';

        // 3. Inventory & Pricing Details
        md += '## 📦 Inventory & Pricing Details\n';
        md += '| PID | Name | Category | Stock | Price (INR) | Availability |\n';
        md += '| :--- | :--- | :--- | :--- | :--- | :--- |\n';
        
        products.sort((a, b) => (a.category || '').localeCompare(b.category || '')).forEach(p => {
            const stockStatus = (p.stock || 0) <= (p.lowStockThreshold || 5) ? `⚠️ **${p.stock}**` : p.stock;
            const price = p.price_inr || p.price || 0;
            md += `| \`${p.pid}\` | ${p.name} | ${p.category} | ${stockStatus} | ₹${price} | ${p.availability || 'N/A'} |\n`;
        });
        md += '\n';

        // 4. Low Stock Alerts
        if (lowStock.length > 0) {
            md += '## 🚨 Low Stock Alerts\n';
            md += '| PID | Name | Stock | Status |\n';
            md += '| :--- | :--- | :--- | :--- |\n';
            lowStock.forEach(p => {
                md += `| \`${p.pid}\` | ${p.name} | ${p.stock} | ${p.stock === 0 ? 'Out of Stock' : 'Critical'} |\n`;
            });
            md += '\n';
        }

        const reportPath = path.join('C:', 'Users', 'admin', '.gemini', 'antigravity', 'brain', '62ee00b0-7ae6-4b38-a8be-24311d1f0498', 'product_report.md');
        fs.writeFileSync(reportPath, md);
        console.log('Report generated at:', reportPath);

    } catch (err) {
        console.error('Error generating report:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

generateMarkdownReport();
