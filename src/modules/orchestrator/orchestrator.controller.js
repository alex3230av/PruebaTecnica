
export async function createAndConfirmOrder(req, res, next) {
  try {
    const { customer_id, items, idempotency_key, correlation_id } = req.body || {};
    console.log('REQUEST --> /orchestrator/create-and-confirm-order', JSON.stringify(req.body));
    if (!customer_id || !Array.isArray(items) || !items.length) {
      const err = new Error('customer_id and items[] required');
      err.status = 400;
      throw err;
    }
    if (!idempotency_key) {
      const err = new Error('idempotency_key required');
      err.status = 400;
      throw err;
    }

    // Bases: Customers en :3001, Products+Orders en :3002
    // Permite override por ENV para local/externo:
    let customersBaseUrl;
    if(process.env.ISLOCAL==='true') {
      customersBaseUrl = `${process.env.CUSTOMERS_API_BASE}`;
    }else{
      customersBaseUrl = `${process.env.CUSTOMERS_API_BASE_EXTERNAL}`;
    };

    let ordersBaseUrl;
    if(process.env.ISLOCAL==='true') {
      ordersBaseUrl = `${process.env.ORDERS_API_BASE}`;
    }else{
      ordersBaseUrl = `${process.env.PRODUCTS_API_BASE_EXTERNAL}`;
    };
    console.log('Using Customers base URL:', customersBaseUrl);
    console.log('Using Orders base URL:', ordersBaseUrl);
    const serviceToken = process.env.SERVICE_TOKEN || 'service-secret';

    // 1) Validar cliente (Customers /internal)
    console.log('Validating customer_id', customer_id);
    const custResp = await fetch(`${customersBaseUrl}/internal/customers/${customer_id}`, {
      headers: { Authorization: `Bearer ${serviceToken}` }
    });
    if (custResp.status === 404) {
      const err = new Error('customer not found');
      err.status = 400;
      throw err;
    }
    if (!custResp.ok) {
      const err = new Error(`customers/internal error: ${custResp.status}`);
      err.status = 502;
      throw err;
    }
    const customer = await custResp.json();

    // 2) Crear orden (Orders /orders)
    console.log('Creating order for customer_id', customer_id, 'with idempotency_key', idempotency_key);
    const createResp = await fetch(`${ordersBaseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id, items })
    });
    if (!createResp.ok) {
      const payload = await safeJson(createResp);
      const err = new Error(`create order failed: ${createResp.status} ${payload?.error ?? ''}`.trim());
      err.status = mapStatus(createResp.status);
      throw err;
    }
    console.log('Order created, proceeding to confirm, idempotency_key:', idempotency_key);
    const created = await createResp.json(); 

    // 3) Confirmar (Orders /orders/:id/confirm) — idempotente
    console.log('Confirming order id', created.id, 'with idempotency_key', idempotency_key);
    const confirmResp = await fetch(`${ordersBaseUrl}/orders/${created.id}/confirm`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotency_key }
    });
    if (!confirmResp.ok) {
      const payload = await safeJson(confirmResp);
      const err = new Error(`confirm order failed: ${confirmResp.status} ${payload?.error ?? ''}`.trim());
      err.status = mapStatus(confirmResp.status);
      throw err;
    }
    const confirmed = await confirmResp.json();

    // 4) Consolidar respuesta
    console.log('RESPONSE --> /orchestrator/create-and-confirm-order', JSON.stringify({
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone ?? null },
      order: { id: confirmed.id, status: confirmed.status, total_cents: confirmed.total_cents, items: created.items ?? [] }
    }));
    const response = {
      success: true,
      correlationId: correlation_id ?? null,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone ?? null
        },
        order: {
          id: confirmed.id,
          status: confirmed.status,
          total_cents: confirmed.total_cents,
          items: created.items ?? []
        }
      }
    };

    return res.status(201).json(response);
  } catch (err) {
    return next(err);
  }
}

async function safeJson(r) {
  try { return await r.json(); } catch { return null; }
}

function mapStatus(s) {
  // traduce errores aguas arriba a 4xx/5xx razonables
  if (s >= 500) return 502;
  if (s === 404) return 404;
  if (s === 409) return 409;
  return 400;
}
