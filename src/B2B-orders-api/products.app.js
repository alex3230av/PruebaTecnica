import express from 'express';
import morgan from 'morgan';
import productsRoutes from '../modules/products/products.routes.js';
import ordersRoutes from '../modules/orders/orders.routes.js';

const app = express();
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'products' }));
app.use('/products', productsRoutes);
app.use('/orders', ordersRoutes);

export default app;
