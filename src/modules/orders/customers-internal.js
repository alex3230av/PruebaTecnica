// src/modules/orders/customers-internal.js
export async function fetchCustomerById(baseUrl, id, serviceToken) {
  const r = await fetch(`${baseUrl}/internal/customers/${id}`, {
    headers: { Authorization: `Bearer ${serviceToken}` }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`customers-internal error: ${r.status}`);
  return r.json();
}
