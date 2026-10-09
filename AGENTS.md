# Instrucciones para agentes

Este proyecto usa Next.js 16 (App Router). Consulta la documentación que viene con la
versión instalada en `node_modules/next/dist/docs/` antes de usar APIs de Next.js.

Arquitectura, modelo de datos y permisos: ver `docs/ARQUITECTURA.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
