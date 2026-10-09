# Arquitectura de Have a Long Rest

## Decisiones principales

| Tema | Elección | Por qué |
| --- | --- | --- |
| Framework | **Next.js 16, App Router** | La app es muy interactiva (sesiones, editor, chat, permisos por usuario), no un sitio de contenido estático, que es donde Astro brilla. Next es el framework nativo de Vercel; los Server Components consultan la base de datos directamente y las Server Actions resuelven los formularios sin escribir una API. |
| Estilos | **Tailwind CSS 4** + tokens en CSS | Los colores son variables CSS (`--accent`, `--panel`…) que cada campaña sobrescribe con `data-theme` (temas predefinidos) o con variables en línea (tema personalizado). |
| Base de datos | **Postgres + Drizzle ORM** | Datos relacionales (usuarios ↔ campañas ↔ páginas ↔ mensajes). En local se usa **PGlite** (Postgres en WASM, sin instalar nada); en producción, cualquier Postgres vía `DATABASE_URL`. Mismo SQL en ambos. |
| Autenticación | Sesiones propias en la BD | Cookie `httpOnly` con token aleatorio; en la BD solo su SHA-256. Contraseñas con bcrypt. Migrable a Auth.js o Supabase Auth si se quiere login con Google/Discord. |
| Imágenes | Vercel Blob (producción) / disco (local) | `lib/storage.ts` decide según `BLOB_READ_WRITE_TOKEN`. |
| Chat | Polling (3 s abierto, 20 s cerrado) | Las funciones serverless de Vercel no mantienen WebSockets. El componente está aislado para cambiarlo por Supabase Realtime, Pusher o Ably. |
| Contenido | **Markdown** compatible con Obsidian | Permite importar notas existentes (`[[wikilinks]]`, imágenes) y es portable. Editor con barra de herramientas y vista previa. |

## Estructura

```
app/
  page.tsx                         Explorar (campañas públicas + "Mis campañas")
  login/ registro/                 Autenticación
  perfil/                          Perfil propio: datos, avatar, contraseña, sesiones, borrar cuenta
  u/[username]/                    Perfil público
  campanas/nueva/                  Crear campaña
  c/[campaign]/
    layout.tsx                     Tema, árbol de pestañas, chat
    loading.tsx                    Esqueleto inmediato al navegar
    page.tsx                       Portada: descripción, pestañas, miembros, unirse/salir
    p/[page]/page.tsx              Página de la wiki (+ loading.tsx)
    p/[page]/editar/page.tsx       Editor (equipo de máster)
    nueva/ ajustes/                Crear página · ajustes, miembros, orden, tema
  api/campaigns/[id]/chat/         Polling del chat (grupo y privados)
  api/files/[...path]/             Imágenes subidas en local
  error.tsx global-error.tsx       Errores sin detalles internos
proxy.ts                           CSP con nonce por petición
components/                        UI (MarkdownView, PageEditor, ChatPanel, CampaignNav, ColorWheel…)
lib/
  db/schema.ts                     Modelo de datos (Drizzle)
  permissions.ts                   TODAS las reglas de acceso (funciones puras, con tests)
  campaigns.ts users.ts chat.ts    Consultas que ya filtran por permisos
  actions/                         Server Actions (mutaciones), cada una revalida permisos
  rate-limit.ts                    Límites de peticiones en Postgres
  markdown.ts color.ts themes.ts   Lógica pura con tests
e2e/                               Tests end-to-end (Playwright)
tests/                             Tests unitarios (Vitest)
```

## Modelo de datos

- **users**: `username` (único, minúsculas), `displayName`, `email`, `passwordHash`, `avatarUrl`, `bio`, `favoriteGames[]`.
- **sessions**: `id = sha256(token)`, `userId`, `expiresAt` (30 días).
- **campaigns**: `slug`, nombre, lema, descripción, sistema, portada, `theme` (+ `customTheme` JSON si es
  `custom`), `visibility` (`public`/`private`), `joinPolicy` (`open`/`request`/`closed`), `status`,
  `maxPlayers`, `ownerId`.
- **campaign_members**: (`campaignId`, `userId`), `role` (`owner`/`editor`/`player`), `status`
  (`active`/`pending`), `lastReadMessageId` (no leídos del chat de grupo).
- **pages**: árbol por `parentId` (sin padre = pestaña), `slug` único por campaña, `content` (Markdown),
  `visibility`, `allowedUserIds`, `spoilers`, `position`.
- **messages**: chat por campaña. `recipientId = null` → grupo; con `recipientId` → privado entre
  `userId` y `recipientId`, con `readAt` para los no leídos.
- **rate_limits**: contadores por ventana de tiempo.

## Permisos

Todo pasa por [lib/permissions.ts](../lib/permissions.ts). Las páginas lo usan para decidir qué mostrar y
**cada Server Action lo vuelve a comprobar en el servidor** (las acciones son endpoints POST públicos).

| Rol | Puede |
| --- | --- |
| Visitante / no miembro | Ver campañas públicas y sus páginas `public`. Solicitar entrada o unirse. |
| Pendiente | Lo mismo que un visitante, más cancelar su solicitud. |
| Jugador | Páginas `public` y `members`, las `restricted` en las que esté, chat de grupo y privados. Salir cuando quiera. |
| Co-máster | Todo lo anterior + todas las páginas y bloques de máster, editar páginas, subir imágenes, aprobar solicitudes. |
| Máster | Todo + ajustes y tema, roles, expulsar, ceder la campaña, borrarla. No puede salir sin cederla. |

- **Bloques `:::dm … :::`**: se eliminan **en el servidor** antes de renderizar para jugadores; nunca llegan al navegador.
- **Chat privado**: la consulta filtra siempre por los dos participantes. El máster **no** puede leer los privados entre jugadores.
- **Wikilinks** a páginas ocultas se muestran como texto plano, sin revelar que existen.

## Seguridad

| Medida | Dónde |
| --- | --- |
| **CSP con nonce** por petición (`script-src 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `object-src 'none'`…) | `proxy.ts` |
| Cabeceras: HSTS (producción), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP; sin `X-Powered-By` | `next.config.ts` |
| **Límites de intentos** en Postgres (válidos con muchas instancias serverless): login por IP y por cuenta, registro por IP, cambio de contraseña, creación de campañas, chat, subidas | `lib/rate-limit.ts` |
| Login sin enumeración de usuarios (mismo mensaje y mismo tiempo exista o no la cuenta) | `lib/actions/auth.ts` |
| Contraseñas: bcrypt, 8 caracteres mínimo, máx. 72 bytes (límite real de bcrypt), sin patrones repetitivos | `lib/auth/password.ts` |
| Sesiones: token aleatorio de 256 bits, solo el hash en BD, cookie `__Host-` + `httpOnly` + `Secure` + `SameSite=Lax`; cambio de contraseña cierra las demás sesiones; limpieza periódica de caducadas | `lib/auth/session.ts` |
| CSRF: las Server Actions comprueban el `Origin`; las rutas API solo aceptan GET de lectura | Next.js |
| **Subidas** validadas por sus bytes reales (no por el tipo que declara el navegador), sin SVG, máx. 4 MB; servidas con `nosniff` | `lib/image-type.ts`, `lib/storage.ts` |
| Markdown sin HTML crudo (sin XSS almacenado); enlaces externos con `noopener noreferrer nofollow` | `components/MarkdownView.tsx` |
| Colores de temas validados como `#rrggbb` al guardar **y** al pintar (no se puede inyectar CSS) | `lib/validation.ts`, `lib/themes.ts` |
| Redirecciones solo a rutas internas (sin open redirect) | `lib/actions/shared.ts` |
| Validación de toda entrada con zod y longitudes máximas | `lib/actions/*` |
| Errores sin detalles internos al usuario (solo un código de referencia) | `app/error.tsx` |
| Registro de eventos de seguridad en JSON (`"type":"security"`): logins fallidos, límites, cambios de contraseña, borrados de cuenta | `lib/log.ts` |
| CI: lint, tipos, tests, `npm audit` y build en cada PR + tests end-to-end; Dependabot semanal | `.github/` |

**Decisión consciente:** las páginas de la wiki tienen `loading.tsx` para que la navegación sea
instantánea. Next.js envía esas respuestas en streaming antes de comprobar el acceso, así que una página
denegada responde **200** con la página 404 y `noindex` en vez de un 404 HTTP. El contenido no se filtra
(se comprueba el permiso antes de cargarlo). Está documentado en Next y cubierto por los tests e2e.

## Navegación

- Árbol lateral con líneas guía por nivel, chevron separado del enlace, contador de subpáginas, la ruta
  hasta la página actual abierta y resaltada, y buscador con la ruta de cada resultado.
- Rendimiento: `loading.tsx` (esqueleto instantáneo y prefetch parcial de Next), prefetch completo al
  pasar el ratón por un enlace del árbol, consultas en paralelo y memoizadas por petición. En producción,
  clic → página visible en ~50-110 ms (en `npm run dev` es más lento porque compila cada ruta la primera vez
  y no hace prefetch).

## Próximos pasos sugeridos

1. **Invitaciones por enlace** para campañas cerradas o privadas.
2. **Importador de Obsidian** desde la web (subir un `.zip` del vault), reutilizando `scripts/seed.ts`.
3. **Chat en tiempo real** (Supabase Realtime / Ably) y notificaciones.
4. **Historial de versiones** de las páginas para deshacer cambios.
5. **Verificación de email y recuperación de contraseña** (requiere un proveedor de correo, p. ej. Resend).
6. Borrar de Vercel Blob las imágenes que dejan de usarse (avatares antiguos, imágenes quitadas de páginas).
7. **Fichas de personaje** genéricas por campaña (plantillas por sistema de juego).
