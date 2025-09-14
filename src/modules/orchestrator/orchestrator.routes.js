import { Router } from 'express';
import { createAndConfirmOrder } from './orchestrator.controller.js';

const r = Router();

r.post('/create-and-confirm-order', createAndConfirmOrder);

export default r;
