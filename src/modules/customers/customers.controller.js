import { pool } from "./../../db/database.js"
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
    const search = String(req.query.search ?? '');
    const cursor = Number(req.query.cursor ?? 0);
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    console.log('REQUEST -->GET /customers (listCustomers) ', search, cursor, limit );

    const params = [];
    let where = '';
    if (search) {
      where = 'WHERE name LIKE ? OR email LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    params.push(cursor, limit);

    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, created_at
       FROM customers
       ${where}
       ORDER BY id ASC
       LIMIT ?, ?`,
      params
    );
    const response = res.json({
      data: rows,
      nextCursor: rows.length ? rows[rows.length - 1].id : null
    });
    console.log('RESPONSE -->GET /customers (listCustomers) ',  JSON.stringify(response));
    return response;
  } catch (err) {
    const { status, code, message } = logError(err, req);
    return res.status(status).json({ error: message, code });
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