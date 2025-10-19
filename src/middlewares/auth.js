export function requireServiceToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const expected = process.env.SERVICE_TOKEN || 'service-secret';
  if (token && token === expected) { return next();} 
  const err = new Error('unauthorized');
  err.status = 401;
  // Log seguro (no imprimas el token)
  console.error('AUTH FAIL', {
    hasAuthHeader: Boolean(token),
    tokenLen: token.length,
    expectedLen: expected.length
  });
  return next(err);
}
