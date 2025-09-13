// src/modules/orders/orders.middleware.js
export function withIdempotencyKey(req, res, next) {
  const key = req.header('X-Idempotency-Key');
  if (!key) {
    const err = new Error('X-Idempotency-Key required'); err.status = 400;
    return next(err);
  }
  req.idempotencyKey = key;
  next();
}
