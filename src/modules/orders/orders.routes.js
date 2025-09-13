// src/modules/orders/orders.routes.js
import { Router } from 'express';
import * as ctrl from './orders.controller.js';
import { withIdempotencyKey } from './orders.middleware.js';

const r = Router();
r.post('/', ctrl.createOrder);                                // POST /orders
r.get('/:id', ctrl.getOrderById);                             // GET /orders/:id (incluye items)
r.get('/', ctrl.listOrders);                                  // GET /orders?status=&from=&to=&cursor=&limit=
r.post('/:id/confirm', withIdempotencyKey, ctrl.confirmOrder);// POST /orders/:id/confirm (idempotente)
r.post('/:id/cancel', ctrl.cancelOrder);                      // POST /orders/:id/cancel
export default r;
