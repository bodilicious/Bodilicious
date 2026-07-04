import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dirs = [
  path.join(__dirname, 'public', 'products'),
  path.join(__dirname, 'public', 'ingredients')
];

async function processDirectory(dir) {
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.match(/\.(webp|png|jpg|jpeg)$/i)) {
        const filePath = path.join(dir, file);
        const tempPath = filePath + '.tmp';
        
        try {
          let instance = sharp(filePath);
          const metadata = await instance.metadata();
          
          // Resize ingredients to 600px, products to 800px
          const targetWidth = dir.includes('ingredients') ? 600 : 800;
          if (metadata.width > targetWidth) {
             instance = instance.resize({ width: targetWidth, withoutEnlargement: true });
          }
          
          await instance
            .webp({ quality: 75, effort: 6 }) // better compression for webp
            .toFile(tempPath);
            
          const oldSize = (await fs.stat(filePath)).size;
          const newSize = (await fs.stat(tempPath)).size;
          
          // Only replace if it's actually smaller
          if (newSize < oldSize) {
             await fs.rename(tempPath, filePath);
             console.log(`Compressed ${file}: ${(oldSize/1024/1024).toFixed(2)}MB -> ${(newSize/1024/1024).toFixed(2)}MB`);
          } else {
             await fs.unlink(tempPath);
             console.log(`Skipped ${file}: not smaller`);
          }
        } catch (e) {
          console.error(`Error processing ${file}:`, e.message);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error reading directory ${dir}:`, err.message);
    }
  }
}

async function main() {
  console.log('Starting image compression...');
  for (const dir of dirs) {
    console.log(`Processing ${dir}...`);
    await processDirectory(dir);
  }
  console.log('Done!');
}

main();
