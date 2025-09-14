// src/modules/orders/customers-internal.js
export async function fetchCustomerById(baseUrl, id, serviceToken) {
  console.log('fetchCustomerById called with id:', `${baseUrl}/internal/customers/${id}`);
  console.log('Using serviceToken:', serviceToken);
  const r = await fetch(`${baseUrl}/internal/customers/${id}`, {
    headers: { Authorization: `${serviceToken}` }
  });
  console.log('Fetch to Customers /internal/customers/:id', id, r.status);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`customers-internal error: ${r.status}`);
  return r.json();
}

