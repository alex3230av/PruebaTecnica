import express from "express";
import morgan from "morgan";

import customersRoutes, { internalRouter as internalCustomers } from './modules/customers/customers.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';

const app = express();

//Settings
app.set("port", Number(process.env.PORT || 3001));

//Middlewares
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


//Rooutes
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/customers', customersRoutes);
app.use('/internal', internalCustomers);
app.use('/products', productsRoutes);
app.use('/orders', ordersRoutes);

export default app;