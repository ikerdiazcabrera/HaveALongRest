# Have a Long Rest

Red social para campañas de rol: los usuarios exploran campañas activas, se unen (o crean la suya) y cada
campaña tiene una wiki editable por su máster, con páginas visibles según el rol de cada jugador, tema
visual propio, chat de grupo y chats privados entre miembros. Cada usuario tiene un perfil público.

Stack: **Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Postgres + Drizzle ORM**. Pensado para
desplegarse en Vercel. Arquitectura y decisiones de diseño en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Puesta en marcha

Requisitos: Node 20.12+ (probado con Node 24). No hace falta instalar Postgres: en local se usa
[PGlite](https://pglite.dev), un Postgres embebido que guarda los datos en `.data/pglite`.

```bash
npm install
npm run db:reset   # crea la base de datos local y carga los datos de demo
npm run dev        # http://localhost:3000 (aplica migraciones pendientes al arrancar)
```

### Usuarios de demo

Contraseña de todos: `longrest`

| Usuario | Para probar |
| --- | --- |
| `dm` | Máster de **Caminapiedras** (importada de la wiki antigua) y de la campaña privada *Nacidos de la Bruma* |
| `iker`, `salva`, `nico`… | Jugadores de Caminapiedras. `iker` tiene un chat privado con `dm`, juega en *La Cripta* y ve su página restringida |
| `ana` | Máster de *La Cripta del Rey Olvidado* (entrada libre, tema personalizado) y co-máster de *Nacidos de la Bruma* |
| `bruno` | Usuario sin campañas: prueba a solicitar entrada o unirte |

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (ejecuta antes las migraciones) |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm test` | Tests unitarios (permisos, Markdown, colores, validaciones de seguridad) |
| `npm run test:e2e` | Tests end-to-end con Playwright contra un build de producción (base de datos propia en `.data/pglite-e2e`). La primera vez: `npx playwright install chromium`, o usa tu navegador con `PW_CHANNEL=msedge` / `PW_CHANNEL=chrome` |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run check` | Lint + tipos + tests unitarios (lo mismo que comprueba la CI) |
| `npm run db:generate` | Genera una migración SQL tras cambiar `lib/db/schema.ts` |
| `npm run db:migrate` | Aplica migraciones a la base de datos configurada |
| `npm run db:seed` | Borra y recarga los datos de demo (solo en local salvo `-- --force`) |
| `npm run db:reset` | Borra la base de datos local (PGlite) y la recrea con la demo |

> PGlite no admite varios procesos a la vez: para `db:seed` o `db:reset` para antes el servidor de desarrollo.
>
> `npm run dev` compila cada página la primera vez que se visita y no hace prefetch, así que navegar es
> más lento que en producción. Para probar la velocidad real: `npm run build && npm start`.

## Integración continua

`.github/workflows/ci.yml` ejecuta en cada push a `main` y en cada pull request: lint, tipos, tests
unitarios, `npm audit` de dependencias de producción, build y tests end-to-end. Dependabot propone
actualizaciones semanales. Medidas de seguridad: ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md#seguridad).

## Despliegue en Vercel

1. Crea una base de datos Postgres (Neon o Supabase, por ejemplo, ambos con plan gratuito) y copia su URL de
   conexión (la del *pooler* si la ofrece).
2. En Vercel, importa el repositorio y añade las variables de entorno:
   - `DATABASE_URL`: la URL de Postgres.
   - `BLOB_READ_WRITE_TOKEN`: crea un almacén de **Vercel Blob** en el proyecto (se añade solo).
3. Despliega. El script `vercel-build` aplica las migraciones antes de compilar.
4. (Opcional) Carga la demo en esa base de datos desde tu equipo:
   `DATABASE_URL=… npm run db:seed -- --force`. **Borra todo lo que haya.**

Variables de ejemplo en [.env.example](.env.example).
