import { pool } from "./../../db/database.js"
import { validateEmail } from '../../utils/generic-utils.js';
import { logError, makeError } from "./../../utils/error-logger.js";

export async function createCustomer(req, res) {
  try {
    console.log('REQUEST -->POST /customers ', JSON.stringify(req.body));
    const { name, email, phone } = req.body || {};

    if (!name || !email) {
        const err = makeError('name and email required', { status: 400, code: 'VALIDATION' });
        const { status, code, message } = logError(err, req);
        return res.status(status).json({ error: message, code });
    }

    if (!validateEmail(email, req, res)) return;

    const [r] = await pool.execute(
      'INSERT INTO customers (name, email, phone) VALUES (?,?,?)',
      [name, email, phone ?? null]
    );

    const [[customer]] = await pool.execute(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ?',
      [r.insertId]
    );

    console.log('RESPONSE -->POST /customers ', JSON.stringify(customer));
    return res.status(201).json(customer);
  } catch (err) {
     if (err.code === 'ER_DUP_ENTRY') {
      err.status = 409;
    }

    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

export async function getCustomerById(req, res) {
  try {
    console.log('REQUEST -->/customers:id ', req.params.id);
    const id = Number(req.params.id);
    const [[row]] = await pool.execute(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ?',
      [id]
    );
    if (!row) {
      const err = makeError('not found', { status: 404, code: 'NOT_FOUND' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }
    console.log('RESPONSE -->GET /customers:id',  JSON.stringify(row));
    return res.json(row);
  } catch (err) {
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

export async function listCustomers(req, res) {
   try {
    const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const rawCursor = req.query.cursor ?? '0';
    const rawLimit  = req.query.limit  ?? '20';

    const cursor = Number.parseInt(String(rawCursor), 10);
    const limit  = Number.parseInt(String(rawLimit),  10);

    if (!Number.isInteger(cursor) || cursor < 0) {
      return res.status(400).json({ error: 'INVALID_QUERY', code: 'VALIDATION_CURSOR' });
    }
    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
      return res.status(400).json({ error: 'INVALID_QUERY', code: 'VALIDATION_LIMIT' });
    }

    let sql = `
      SELECT id, name, email, phone, created_at
      FROM customers
      WHERE 1=1
    `;
    const params = [];

    if (rawSearch) {
      sql += ` AND (name LIKE ? OR email LIKE ?)`;
      const like = `%${rawSearch}%`;
      params.push(like, like);
    }

    sql += ` ORDER BY id ASC LIMIT ${limit} OFFSET ${cursor}`;

    const [rows] = await pool.execute(sql, params);

    const nextCursor = cursor + rows.length;

    const payload = { data: rows, nextCursor, limit };
    console.log('RESPONSE --> GET /customers (listCustomers)', {
      count: rows.length,
      nextCursor,
      limit
    });
    return res.json(payload);
  } catch (err) {
    console.error('SQL error in listCustomers:', {
      path: req.path,
      query: req.query,
      msg: err.message
    });
    const boom = makeError('DB_ERROR', { status: 500, code: err.code, details: err.message });
    const { status, code, message } = logError(boom, req);
    return res.status(status || 500).json({ error: message || 'DB_ERROR', code: code || err.code });
  }
}

export async function updateCustomer(req, res) {
  try {
    console.log('REQUEST -->PUT /customers/:id (update) ', JSON.stringify(req.body));
    const id = Number(req.params.id);
    const { name, email, phone } = req.body || {};
    if (!name && !email && !phone) {
      const err = makeError('no fields to update', { status: 400, code: 'VALIDATION' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }

    const fields = []; const values = [];
    if (name)  { fields.push('name=?');  values.push(name); }
    if (email) { fields.push('email=?'); values.push(email); }
    if (phone) { fields.push('phone=?'); values.push(phone); }
    values.push(id);

     if (!validateEmail(email, req, res)) return;

    await pool.execute(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);

    const [[row]] = await pool.execute(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ?',
      [id]
    );
    if (!row) {
      const err = makeError('not found', { status: 404, code: 'NOT_FOUND' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }
    console.log('RESPONSE -->/PUT customers/:id (update) ',  JSON.stringify(row));
    return res.json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') err.status = 409;
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

export async function deleteCustomer(req, res) {
  try {
    const id = Number(req.params.id);
    console.log('REQUEST -->DELETE /customers:id ', req.params.id);
    const [r] = await pool.execute('DELETE FROM customers WHERE id = ?', [id]);
    if (r.affectedRows === 0) {
      const err = makeError('not found', { status: 404, code: 'NOT_FOUND' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }
    console.log('RESPONSE -->DELETE /customers:id ', 'OK');
    return res.status(204).send();
  } catch (err) {
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}

export async function getInternalCustomerById(req, res) {
  try {
    const id = Number(req.params.id);
    console.log('REQUEST -->GET /customers/:id (getInternalCustomerById) ', id);
    const [[row]] = await pool.execute(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ?',
      [id]
    );
    if (!row) {
      const err = makeError('not found', { status: 404, code: 'NOT_FOUND' });
      const { status, code, message } = logError(err, req);
      return res.status(status).json({ error: message, code });
    }
    console.log('RESPONSE -->GET /customers/:id (getInternalCustomerById) ', JSON.stringify(row));
    return res.json(row);
  } catch (err) {
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
  }
}