const { spawn } = require('child_process');
const start = Date.now();
const child = spawn('node', ['server.js'], { stdio: 'pipe' });
child.stdout.on('data', (data) => {
    process.stdout.write(data);
    if (data.toString().includes('Server running at')) {
        console.log(`Startup took ${Date.now() - start}ms`);
        child.kill();
        process.exit(0);
    }
});
child.stderr.on('data', (data) => {
    process.stderr.write(data);
});
