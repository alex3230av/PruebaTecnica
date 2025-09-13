import express from 'express';
import morgan from 'morgan';
import customersRoutes, { internalRouter as internalCustomers } from './modules/customers/customers.routes.js';

const app = express();
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'customers' }));
app.use('/customers', customersRoutes);
app.use('/internal', internalCustomers);
export default app;
