import express from 'express';
import morgan from 'morgan';
import orchestratorRoutes from '../modules/orchestrator/orchestrator.routes.js';

const app = express();
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'orchestrator' }));
app.use('/orchestrator', orchestratorRoutes);

export default app;
