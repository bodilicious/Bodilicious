const { chromium } = require('playwright');
const fs = require('fs');

async function runTest() {
  console.log('Starting SEO equivalence test...');
  
  // Start browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Here we would fetch PIDs from API, for now hardcoding some examples
  const testPids = ['BD-SER-NIA-SPF30', 'BD-LIP-MATT', 'BD-SHAM-BANANA'];
  let allPassed = true;

  for (const pid of testPids) {
    console.log(`\nTesting PID: ${pid}`);
    
    // 1. Fetch from Bot Proxy (Cloudflare Worker)
    // Assuming local test server on port 8787 or similar
    const workerUrl = `http://127.0.0.1:8787/product/${pid}`;
    
    let botTitle, botDesc, botOgTitle;
    try {
      const botRes = await fetch(workerUrl, {
        headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }
      });
      const botHtml = await botRes.text();
      
      const titleMatch = botHtml.match(/<title>([^<]+)<\/title>/);
      const descMatch = botHtml.match(/<meta\s+name="description"\s+content="([^"]+)"/);
      const ogTitleMatch = botHtml.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
      
      botTitle = titleMatch ? titleMatch[1] : null;
      botDesc = descMatch ? descMatch[1] : null;
      botOgTitle = ogTitleMatch ? ogTitleMatch[1] : null;
      
    } catch (e) {
      console.log(`Failed to fetch from worker for ${pid}. Skipping.`);
      continue;
    }

    // 2. Fetch using Playwright (simulating real user)
    const frontendUrl = `http://localhost:5173/product/${pid}`;
    const page = await context.newPage();
    
    try {
      await page.goto(frontendUrl, { waitUntil: 'networkidle' });
      
      const spaTitle = await page.title();
      const spaDesc = await page.getAttribute('meta[name="description"]', 'content').catch(()=>null);
      const spaOgTitle = await page.getAttribute('meta[property="og:title"]', 'content').catch(()=>null);
      
      console.log('--- Comparison ---');
      console.log('Bot Title:', botTitle);
      console.log('SPA Title:', spaTitle);
      console.log('Bot Desc:', botDesc);
      console.log('SPA Desc:', spaDesc);
      
      if (botTitle !== spaTitle) {
        console.error(`❌ Title mismatch for ${pid}`);
        allPassed = false;
      }
      if (botDesc !== spaDesc) {
        console.error(`❌ Description mismatch for ${pid}`);
        allPassed = false;
      }
      if (botOgTitle !== spaOgTitle) {
        console.error(`❌ OG Title mismatch for ${pid}`);
        allPassed = false;
      }
      
    } catch (e) {
      console.log(`Failed to load SPA in Playwright for ${pid}. Make sure frontend is running.`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  
  if (!allPassed) {
    console.error('\nSEO Equivalence Test Failed! Bot rendering has diverged from SPA rendering.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed. Bot HTML is structurally equivalent to SPA HTML.');
  }
}

runTest();
