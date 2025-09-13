import { pool } from './../../db/database.js';
import { logError, makeError } from './../../utils/error-logger.js';

// POST /products  {sku único, name, price_cents, stock}
export async function createProduct(req, res) {
  try {
    console.log('REQUEST -->POST /products (create)', JSON.stringify(req.body));
    const { sku, name, price_cents, stock = 0 } = req.body || {};
    if (!sku || !name || typeof price_cents !== 'number') {
      const err = makeError('sku, name, price_cents required', { status: 400, code: 'VALIDATION' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }
    const [r] = await pool.execute(
      'INSERT INTO products (sku, name, price_cents, stock) VALUES (?,?,?,?)',
      [sku, name, price_cents, stock]
    );
    const [[product]] = await pool.execute(
      'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE id=?',
      [r.insertId]
    );
    console.log('RESPONSE --> /products (create)', JSON.stringify(product));
    return res.status(201).json(product);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') err.status = 409;
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

// PATCH /products/:id   {price_cents?, stock?}
export async function patchProduct(req, res) {
  try {
    console.log('REQUEST -->PATCH /products/:id (update)', JSON.stringify(req.body));
    const id = Number(req.params.id);
    const { price_cents, stock } = req.body || {};
    const fields = []; const values = [];
    if (typeof price_cents === 'number') { fields.push('price_cents=?'); values.push(price_cents); }
    if (typeof stock === 'number')       { fields.push('stock=?');       values.push(stock); }
    if (!fields.length) {
      const err = makeError('no fields to update', { status: 400, code: 'VALIDATION' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }
    values.push(id);
    await pool.execute(`UPDATE products SET ${fields.join(', ')} WHERE id=?`, values);

    const [[row]] = await pool.execute(
      'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE id=?',
      [id]
    );
    if (!row) {
      const err = makeError('not found', { status: 404, code: 'NOT_FOUND' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }
    console.log('RESPONSE --> /products/:id (update)', JSON.stringify(row));
    return res.json(row);
  } catch (err) {
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

// GET /products/:id
export async function getProductById(req, res) {
  try {
    console.log('REQUEST --> GET /products/:id (retrieve)', JSON.stringify(req.params));
    const id = Number(req.params.id);
    const [[row]] = await pool.execute(
      'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE id=?',
      [id]
    );
    if (!row) {
      const err = makeError('not found', { status: 404, code: 'NOT_FOUND' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }
    console.log('RESPONSE --> /products/:id (retrieve)', JSON.stringify(row));
    return res.json(row);
  } catch (err) {
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

// GET /products?search=&cursor=&limit=
export async function listProducts(req, res) {
  try {
    const search = String(req.query.search ?? '');
    const cursor = Number(req.query.cursor ?? 0);          // <-- offset
    const limit  = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);

    const params = [];
    let where = '';
    if (search) {
      where = 'WHERE name LIKE ? OR sku LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    params.push(cursor, limit); // <-- offset, then limit

    const [rows] = await pool.execute(
      `SELECT id, sku, name, price_cents, stock, created_at
       FROM products
       ${where}
       ORDER BY id ASC
       LIMIT ?, ?`,
      params
    );
    // nextCursor para offset pagination
    const nextCursor = rows.length ? cursor + rows.length : cursor;

    return res.json({ data: rows, nextCursor });
  } catch (err) {
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}
