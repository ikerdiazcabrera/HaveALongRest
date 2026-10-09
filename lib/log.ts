/**
 * Registro estructurado de eventos de seguridad (logins fallidos, límites alcanzados,
 * borrados de cuenta…). En Vercel aparece en los logs de la función y se puede filtrar
 * por `"type":"security"`. Nunca se registran contraseñas ni tokens.
 */
export function logSecurityEvent(event: string, details: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ type: "security", event, at: new Date().toISOString(), ...details }));
}
