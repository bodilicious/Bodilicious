import fetch from 'node-fetch';

async function testChat(message) {
    console.log(`\nTESTING: "${message}"`);
    try {
        const response = await fetch('http://localhost:5000/api/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await response.json();
        console.log('REPLY:', data.reply);
        if (data.products) {
            console.log('PRODUCTS:', data.products.map(p => p.name).join(', '));
        }
    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

async function runTests() {
    await testChat('Build my routine');
    await testChat('Can you recommend a moisturizer for dry skin with rose extracts?');
}

runTests();
