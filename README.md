# 🌙 Have a Long Rest

Plataforma web para campañas de rol de mesa. Los jugadores descubren campañas activas y se unen a
ellas; cada campaña tiene su propia wiki, que su máster edita desde el navegador, y un chat para la mesa.

## Qué se puede hacer

- **Explorar campañas** públicas, buscarlas por nombre o sistema de juego y unirse (entrada libre o con
  solicitud que aprueba el máster). Se puede salir en cualquier momento.
- **Crear tu propia campaña** y dirigirla: pestañas y subpáginas en árbol, editor Markdown con vista
  previa, subida de imágenes y portada.
- **Control de lo que ve cada uno**: páginas públicas, solo para miembros, para jugadores concretos o
  solo para el máster, y bloques secretos dentro de una página:

  ```markdown
  :::dm
  Esto solo lo ve el equipo de máster.
  :::
  ```

- **Enlaces entre páginas** al estilo Obsidian: `[[Otra página]]`, `[[Página|texto]]`, `[[Página#Sección]]`.
- **Temas visuales** por campaña: predefinidos o uno propio con rueda de color.
- **Chat** de la campaña: canal general y conversaciones privadas entre miembros.
- **Perfil** de usuario: foto, descripción, juegos favoritos y perfil público.
- **Roles**: máster, co-máster y jugador.

## Stack

[Next.js 16](https://nextjs.org) (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL con
[Drizzle ORM](https://orm.drizzle.team) · pensado para [Vercel](https://vercel.com).

En desarrollo no hace falta instalar Postgres: se usa [PGlite](https://pglite.dev), un Postgres embebido
que guarda los datos en `.data/`.

## Puesta en marcha

Requisitos: Node.js 20.12 o superior.

```bash
npm install
npm run db:reset   # crea la base de datos local con datos de demostración
npm run dev        # http://localhost:3000
```

Usuarios de demostración (contraseña `longrest`):

| Usuario | Rol en la demo |
| --- | --- |
| `ana` | Máster de *La Cripta del Rey Olvidado* (pública, entrada libre, tema personalizado) |
| `lyra`, `tomas` | Jugadores de *La Cripta*; `lyra` tiene una página privada y un chat privado con `ana` |
| `dm` | Máster de *Nacidos de la Bruma* (campaña privada) |
| `bruno` | Usuario sin campañas: prueba a unirte a una |

> `npm run dev` compila cada página la primera vez y no precarga enlaces. Para ver la velocidad real:
> `npm run build && npm start`.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (aplica migraciones al arrancar) |
| `npm run build` · `npm start` | Build y servidor de producción |
| `npm run check` | Lint, tipos y tests unitarios |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Tests end-to-end (Playwright) contra un build de producción, con su propia base de datos. La primera vez: `npx playwright install chromium` |
| `npm run db:generate` | Genera una migración tras cambiar `lib/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Recarga los datos de demostración (borra la base de datos local) |
| `npm run db:reset` | Borra la base de datos local y la recrea |

## Despliegue en Vercel

1. Crea una base de datos PostgreSQL (por ejemplo en [Neon](https://neon.tech) o
   [Supabase](https://supabase.com)) y copia su URL de conexión, la del *pooler* si la ofrece.
2. Importa el repositorio en Vercel y define las variables de entorno (ver [.env.example](.env.example)):
   - `DATABASE_URL`: la URL de PostgreSQL.
   - `BLOB_READ_WRITE_TOKEN`: crea un almacén de **Vercel Blob** en el proyecto para las imágenes.
3. Despliega. Las migraciones se aplican solas durante el build (`vercel-build`).

## Documentación

- [Arquitectura, modelo de datos y permisos](docs/ARQUITECTURA.md)
- [Medidas de seguridad](docs/ARQUITECTURA.md#seguridad) y [cómo informar de una vulnerabilidad](SECURITY.md)

Cada push y pull request pasa por la integración continua: lint, tipos, tests unitarios, auditoría de
dependencias, build y tests end-to-end.
