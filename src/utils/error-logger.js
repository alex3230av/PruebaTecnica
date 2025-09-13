// Util para registrar errores con contexto consistente.
// Extrae: status HTTP, code (p.ej. ER_DUP_ENTRY), mensaje, método, path, requestId, etc.

export function extractErrorInfo(err = {}) {
  const status =
    err.status ??
    err.statusCode ??
    (err.response && err.response.status) ?? 
    500;

  const code =
    err.code ??
    (err.response && err.response.data && err.response.data.code) ??
    undefined;

  return {
    status: Number.isInteger(status) ? status : 500,
    code,
    message: err.message || 'internal error',
    name: err.name || 'Error',
    stack: err.stack,
  };
}

// Logger por defecto (console).
export function logError(err, req) {
  const { status, code, message, name, stack } = extractErrorInfo(err);

  const ctx = {
    method: req?.method,
    path: req?.originalUrl || req?.url,
    requestId: req?.headers?.['x-request-id'],
    idemKey: req?.headers?.['x-idempotency-key'],
    ip: req?.ip,
  };

  // Log compacto en una sola línea (útil para prod)
  console.error("ERROR -->",
    JSON.stringify(
      {
        level: 'error',
        ts: new Date().toISOString(),
        status,
        code,
        name,
        message,
        ...ctx,
      }
    )
  );

  // Si estás en dev y quieres ver stack:
  if (process.env.NODE_ENV !== 'production' && stack) {
    console.error(stack);
  }

  // Devuelve datos por si quieres usarlos al responder
  return { status, code, message };
}

// Helper para crear errores con status y código fácilmente
export function makeError(message, { status = 500, code } = {}) {
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
}
