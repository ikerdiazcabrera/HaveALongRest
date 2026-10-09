// Next carga .env automáticamente; los scripts de tsx no.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // el fichero no existe: nada que cargar
  }
}
