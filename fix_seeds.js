const fs = require('fs');
const files = ['./backend/settings/seedHomepageContent.js', './backend/settings/updateHeroSlides.js'];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    const updated = content.replace(/\.png/g, '.webp');
    fs.writeFileSync(f, updated);
    console.log(`Updated ${f}`);
  }
});
