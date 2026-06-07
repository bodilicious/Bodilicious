import express from 'express';
import { Router } from 'express';

const app = express();

const sensitiveLimiter = (req, res, next) => {
  console.log('sensitiveLimiter ran');
  next();
};

const globalLimiter = (req, res, next) => {
  console.log('globalLimiter ran');
  next();
};

const profileRoutes = Router();
profileRoutes.post('/forgot-password', (req, res) => {
  res.json({ success: true, msg: 'hit' });
});

const routes = Router();
routes.use('/user', profileRoutes);

app.use('/api/v1/payment', sensitiveLimiter);
app.use('/api/v1/user', sensitiveLimiter);
app.use('/api/v1', globalLimiter, routes);

// test the route
const server = app.listen(3000, async () => {
  try {
    const res = await fetch('http://localhost:3000//api/v1/user/forgot-password', { method: 'POST' });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error(err);
  } finally {
    server.close();
    process.exit(0);
  }
});
