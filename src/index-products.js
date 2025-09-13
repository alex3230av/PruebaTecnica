import app from './products.app.js';
const port = Number(process.env.PRODUCTS_PORT || 3002);
app.listen(port, () => console.log(`Products API on :${port}`));
