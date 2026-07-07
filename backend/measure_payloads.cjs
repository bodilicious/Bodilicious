const http = require('http');

function request(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function test() {
  console.log("Testing extreme bounds limit=10000&page=50000.5&slim=false");
  const url = 'http://localhost:5000/api/v1/products?limit=10000&page=50000.5&slim=false';
  const res = await request(url);
  const parsed = JSON.parse(res.body);
  console.log(`- Returned page: ${parsed.page}`);
  console.log(`- Returned limit: ${parsed.products ? parsed.products.length : 0} (Max items)`);
  console.log(`- Raw JSON String Length: ${(res.body.length / 1024).toFixed(2)} KB`);

  console.log("\nTesting 'heaviest' response (limit=100 & slim=false on page 1)");
  const url2 = 'http://localhost:5000/api/v1/products?limit=100&slim=false';
  const res2 = await request(url2);
  const parsed2 = JSON.parse(res2.body);
  
  // Calculate average reviews per product
  let totalReviews = 0;
  if(parsed2.products) {
    parsed2.products.forEach(p => {
      if (p.reviews) totalReviews += p.reviews.length;
    });
    console.log(`- Returned products: ${parsed2.products.length}`);
    console.log(`- Total embedded reviews: ${totalReviews}`);
  }
  console.log(`- Max payload byte size: ${(res2.body.length / 1024 / 1024).toFixed(3)} MB`);
}

test().catch(console.error);
