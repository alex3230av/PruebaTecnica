import { logError, makeError } from "./error-logger.js";

export function validateEmail(email, req, res) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Verifica si el correo es inválido
  if (!emailRegex.test(email)) {
    const err = makeError('invalid email format', {
      status: 400,
      code: 'VALIDATION_EMAIL',
      details: { email }
    });

    const { status, code, message } = logError(err, req);
    res.status(status).json({ error: message, code });
    return false; // indica al controlador que debe detener la ejecución
  }

  return true; // válido
}