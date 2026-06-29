const { spawn } = require('child_process');
const start = Date.now();
const child = spawn('node', ['-e', `
const s = Date.now();
console.log('0ms: script start');
require('dotenv').config();
console.log(Date.now()-s + 'ms: dotenv');
const mongoose = require('mongoose');
console.log(Date.now()-s + 'ms: require mongoose');
const app = require('./app.js');
console.log(Date.now()-s + 'ms: require app');
const Product = require('./products/models.js').default;
console.log(Date.now()-s + 'ms: require product');

mongoose.connect(process.env.MONGO_URI, {dbName: process.env.DB_NAME}).then(async () => {
    console.log(Date.now()-s + 'ms: mongo connected');
    process.exit(0);
});
`], { stdio: 'pipe' });
child.stdout.on('data', (data) => process.stdout.write(data));
child.stderr.on('data', (data) => process.stderr.write(data));
