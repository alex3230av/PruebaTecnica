USE B2B;

-- CLIENTES (usa INSERT IGNORE para evitar duplicados si se reejecuta)
INSERT IGNORE INTO customers (name, email, phone) VALUES
('ACME Corp', 'ops@acme.com', '+1 555 1000'),
('Globex',    'ops@globex.com', '+1 555 2000'),
('Initech',   'ops@initech.com', '+1 555 3000');

-- PRODUCTOS
INSERT IGNORE INTO products (sku, name, price_cents, stock) VALUES
('SKU-001', 'Widget A', 129900, 50),
('SKU-002', 'Widget B', 239900, 30),
('SKU-003', 'Widget C',   9999, 200);

-- EJEMPLO de una orden CREATED con items (opcional, útil para probar GET /orders/:id)
-- Calcula totales coherentes
-- Orden para customer_id=1 con 2x SKU-001 (129900) y 1x SKU-003 (9999)
INSERT INTO orders (customer_id, status, total_cents)
VALUES (1, 'CREATED', 2*129900 + 1*9999);

SET @order_id = LAST_INSERT_ID();

INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents)
SELECT @order_id, p1.id, 2, p1.price_cents, 2*p1.price_cents FROM products p1 WHERE p1.sku='SKU-001';
INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents)
SELECT @order_id, p3.id, 1, p3.price_cents, 1*p3.price_cents FROM products p3 WHERE p3.sku='SKU-003';
-- (Opcional) Ajusta stock para simular descuento en creación (si quieres partir de un estado realista)
-- UPDATE products SET stock = stock - 2 WHERE sku='SKU-001';
-- UPDATE products SET stock = stock - 1 WHERE sku='SKU-003';
