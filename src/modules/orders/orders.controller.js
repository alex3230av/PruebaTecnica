// src/modules/orders/orders.controller.js
import { pool } from '../../db/database.js';
import { logError, makeError } from '../../utils/error-logger.js';
import { fetchCustomerById } from './customers-internal.js';

// POST /orders  {customer_id, items:[{product_id, qty}]}
export async function createOrder(req, res) {
  let conn;
  try {
    console.log('REQUEST --> /orders (create)\n', JSON.stringify(req.body));
    const { customer_id, items } = req.body || {};
    if (!customer_id || !Array.isArray(items) || items.length === 0) {
      const err = makeError('customer_id and items[] required', { status: 400, code: 'VALIDATION' });
      const { status, code, message } = logError(err, req);
      console.error('ERROR --> /orders (create)\n', JSON.stringify({ status, code, message }));
      return res.status(status).json({ error: message, code });
    }

    // 1) Validar cliente vía Customers /internal
    const base = process.env.CUSTOMERS_API_BASE || `http://localhost:${process.env.PORT || 3001}`;
    const okCustomer = await fetchCustomerById(base, customer_id, process.env.SERVICE_TOKEN || 'service-secret');
    if (!okCustomer) {
      const err = makeError('customer not found', { status: 400, code: 'INVALID_CUSTOMER' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }

    // 2) Transacción: verificar stock, crear order, items, descontar stock
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Obtener productos necesarios
    const ids = items.map(i => Number(i.product_id));
    const placeholders = ids.map(() => '?').join(',');
    const [prods] = await conn.query(
      `SELECT id, price_cents, stock FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
      ids
    );
    const byId = new Map(prods.map(p => [p.id, p]));

    // Validar y calcular total
    let total = 0;
    for (const it of items) {
      const p = byId.get(Number(it.product_id));
      if (!p) {
        const err = makeError(`product ${it.product_id} not found`, { status: 400, code: 'INVALID_PRODUCT' });
        const { status, code, message } = logError(err, req);
        await conn.rollback(); conn.release();
        return res.status(status).json({ error: message, code });
      }
      if (p.stock < it.qty) {
        const err = makeError(`insufficient stock for product ${it.product_id}`, { status: 409, code: 'OUT_OF_STOCK' });
        const { status, code, message } = logError(err, req);
        await conn.rollback(); conn.release();
        return res.status(status).json({ error: message, code });
      }
      total += p.price_cents * it.qty;
    }

    // Crear orden
    const [ord] = await conn.execute(
      'INSERT INTO orders (customer_id, status, total_cents) VALUES (?, "CREATED", ?)',
      [customer_id, total]
    );
    const orderId = ord.insertId;

    // Insertar items + descontar stock
    for (const it of items) {
      const p = byId.get(Number(it.product_id));
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?)',
        [orderId, p.id, it.qty, p.price_cents, p.price_cents * it.qty]
      );
      await conn.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [it.qty, p.id, it.qty]
      );
    }

    await conn.commit(); conn.release();

    const [[order]] = await pool.execute('SELECT * FROM orders WHERE id=?', [orderId]);
    const [itemsRows] = await pool.execute(
      'SELECT product_id, qty, unit_price_cents, subtotal_cents FROM order_items WHERE order_id=?',
      [orderId]
    );

    console.log('RESPONSE --> /orders (create)\n', JSON.stringify({ ...order, items: itemsRows }));
    return res.status(201).json({ ...order, items: itemsRows });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch {} conn.release(); }
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

// GET /orders/:id  (incluye items)
export async function getOrderById(req, res) {
  try {
    const id = Number(req.params.id);
    const [[order]] = await pool.execute('SELECT * FROM orders WHERE id=?', [id]);
    if (!order) {
      const err = makeError('not found', { status: 404, code: 'NOT_FOUND' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }
    const [items] = await pool.execute(
      'SELECT product_id, qty, unit_price_cents, subtotal_cents FROM order_items WHERE order_id=?',
      [id]
    );
    console.log('RESPONSE --> /orders/:id (retrieve)', JSON.stringify({ ...order, items }));
    return res.json({ ...order, items });
  } catch (err) {
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

// GET /orders?status=&from=&to=&cursor=&limit=
export async function listOrders(req, res) {
  try {
    const { status, from, to } = req.query;
    const cursor = Number(req.query.cursor ?? 0);
    const limit  = Math.min(Number(req.query.limit ?? 20), 100);

    const params = [];
    const where = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (from)   { where.push('created_at >= ?'); params.push(from); }
    if (to)     { where.push('created_at <= ?'); params.push(to); }
    let whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(cursor, limit);

    const [rows] = await pool.execute(
      `SELECT id, customer_id, status, total_cents, created_at
       FROM orders
       ${whereSql}
       ORDER BY id ASC
       LIMIT ?, ?`,
      params
    );
    return res.json({ data: rows, nextCursor: rows.length ? rows.at(-1).id : null });
  } catch (err) {
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

// POST /orders/:id/confirm  (idempotente por X-Idempotency-Key)
export async function confirmOrder(req, res) {
  const orderId = Number(req.params.id);
  const key = req.idempotencyKey;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Idempotency: ¿existe DONE?
    const [[idem]] = await conn.execute(
      'SELECT status, response_body FROM idempotency_keys WHERE `key`=? AND target_type="ORDER_CONFIRM" AND target_id=? FOR UPDATE',
      [key, orderId]
    );
    if (idem && idem.status === 'DONE') { 
      await conn.commit(); conn.release();
      return res.json(JSON.parse(idem.response_body));
    }
    // Si no existe, crear PENDING
    if (!idem) {
      await conn.execute(
        'INSERT INTO idempotency_keys (`key`, target_type, target_id, status, created_at) VALUES (?, "ORDER_CONFIRM", ?, "PENDING", NOW())',
        [key, orderId]
      );
    }

    // 2) Leer la orden
    const [[order]] = await conn.execute('SELECT * FROM orders WHERE id=? FOR UPDATE', [orderId]);
    if (!order) {
      const err = makeError('not found', { status: 404, code: 'NOT_FOUND' });
      const { status, code, message } = logError(err, req);
      await conn.rollback(); conn.release();
      return res.status(status).json({ error: message, code });
    }
    if (order.status === 'CONFIRMED') {
      const payload = { ...order, alreadyConfirmed: true };
      await conn.execute(
        'UPDATE idempotency_keys SET status="DONE", response_body=? WHERE `key`=? AND target_type="ORDER_CONFIRM" AND target_id=?',
        [JSON.stringify(payload), key, orderId]
      );
      await conn.commit(); conn.release();
      return res.json(payload);
    }
    if (order.status === 'CANCELED') {
      const err = makeError('order canceled', { status: 409, code: 'ORDER_CANCELED' });
      const { status, code, message } = logError(err, req);
      await conn.rollback(); conn.release();
      return res.status(status).json({ error: message, code });
    }

    // 3) Confirmar
    await conn.execute('UPDATE orders SET status="CONFIRMED" WHERE id=?', [orderId]);
    const [[fresh]] = await conn.execute('SELECT * FROM orders WHERE id=?', [orderId]);

    const payload = { ...fresh };
    await conn.execute(
      'UPDATE idempotency_keys SET status="DONE", response_body=? WHERE `key`=? AND target_type="ORDER_CONFIRM" AND target_id=?',
      [JSON.stringify(payload), key, orderId]
    );
    await conn.commit(); conn.release();
    return res.json(payload);
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch {} conn.release(); }
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

// POST /orders/:id/cancel
// Regla: si CREATED → cancela y restaura stock.
//        si CONFIRMED → permitir cancelación dentro de 10 min de created_at.
export async function cancelOrder(req, res) {
  const orderId = Number(req.params.id);
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[order]] = await conn.execute('SELECT * FROM orders WHERE id=? FOR UPDATE', [orderId]);
    if (!order) {
      const err = makeError('not found', { status: 404, code: 'NOT_FOUND' });
      const { status, code, message } = logError(err, req);
      await conn.rollback(); conn.release();
      return res.status(status).json({ error: message, code });
    }

    const [items] = await conn.execute(
      'SELECT product_id, qty FROM order_items WHERE order_id=?',
      [orderId]
    );

    const nowWithin10 =
      order.created_at && (Date.now() - new Date(order.created_at).getTime()) <= 10 * 60 * 1000;

    if (order.status === 'CREATED' || (order.status === 'CONFIRMED' && nowWithin10)) {
      // restaurar stock
      for (const it of items) {
        await conn.execute('UPDATE products SET stock = stock + ? WHERE id=?', [it.qty, it.product_id]);
      }
      await conn.execute('UPDATE orders SET status="CANCELED" WHERE id=?', [orderId]);
      await conn.commit(); conn.release();
      const [[fresh]] = await pool.execute('SELECT * FROM orders WHERE id=?', [orderId]);
      return res.json(fresh);
    }

    const err = makeError('cannot cancel (rule)', { status: 409, code: 'CANNOT_CANCEL' });
    const { status, code, message } = logError(err, req);
    await conn.rollback(); conn.release();
    return res.status(status).json({ error: message, code });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch {} conn.release(); }
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}
