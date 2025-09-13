import app from './customers.app.js';
const port = Number(process.env.CUSTOMERS_PORT || 3001);
app.listen(port, () => console.log(`Customers API on :${port}`));
