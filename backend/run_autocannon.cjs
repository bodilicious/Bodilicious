const autocannon = require('autocannon');

const instance = autocannon({
  url: 'http://localhost:5000/api/v1/products?limit=10000&page=50000.5',
  connections: 50,
  duration: 5
}, console.log);

autocannon.track(instance);
