# Arachis — Puesta en marcha (duplicado de WOW)

Este repo es una copia del sistema WOW, rebrandeada para **Arachis** y con la
base de datos **limpia** (sin pedidos, clientes, productos, recetas, insumos, etc.).

Solo comparte el código con WOW: cada marca tiene su propia base de datos
(Supabase), su propio repo y su propio deploy (Vercel).

## 1. Base de datos (Supabase — cuenta rbenito@ebenito.com.ar)

1. Proyecto **Arachis** ya creado (org *Estudio Benito*, plan Free).
2. Abrí **SQL Editor → New query**, pegá TODO el contenido de
   [`supabase/schema.sql`](./supabase/schema.sql) y dale **Run**.
   Eso crea todas las tablas, RLS, funciones y el bucket de imágenes. Sin datos.
3. En **Project Settings → API** copiá:
   - **Project URL** (ej. `https://abcd1234.supabase.co`)
   - **anon public key**
   - **service_role key**

### Crear el usuario admin
- **Authentication → Users → Add user** (email + contraseña). Con eso ya podés
  entrar al panel. El primer login crea el perfil con rol `operator`; si querés
  rol `admin`, cambialo en la tabla `profiles` (columna `role` → `admin`).

## 2. Variables de entorno

Copiá `.env.local.example` a `.env.local` y completá con los datos del paso 1.
Las mismas variables van en Vercel (paso 4).

## 3. Repo de GitHub

Subí este código a un repo nuevo llamado **arachis** (ver instrucciones abajo).

## 4. Deploy en Vercel (cuenta benitoric@gmail.com)

1. **Add New → Project** → importá el repo `benitoric/arachis`.
2. En **Environment Variables** cargá las 3 de Supabase (y las de WhatsApp si usás).
3. **Deploy**.
4. Cuando tengas el dominio, configuralo en **Settings → Domains**.

## 5. Ajustes finales de marca (cuando tengas los datos)

Buscá y reemplazá estos placeholders:

| Placeholder | Dónde | Qué poner |
|---|---|---|
| `TU-PROYECTO.supabase.co` | `next.config.mjs` | El dominio real del Supabase de Arachis (para que carguen las imágenes) |
| `TU-TELEFONO` | `promo_settings` (DB) y `app/(dashboard)/promos/page.tsx` | Teléfono de contacto |
| `https://TU-DOMINIO/pedidos` | `promo_settings` (DB) y código | URL pública del portal |
| `TU-EMAIL@dominio.com`, `@TU_INSTAGRAM` | `lib/utils/generateQuotePDF.ts` | Email e Instagram para PDFs de presupuesto |
| `public/logo.png` | archivo | Reemplazá por el logo de Arachis (mismo nombre) |
| `theme_color: "#7b3f00"` | `app/manifest.ts`, `app/layout.tsx` | Color de la marca (opcional) |
| Subtítulo "Repostería Artesanal" | `app/(dashboard)/promos/page.tsx` | El rubro/eslogan de Arachis |
| Colores del tema | `tailwind.config.ts` | Paleta de la marca (opcional) |

> Nota: el teléfono/URL del portal también se editan desde el panel
> (**Promos → Ajustes**), que escribe en `promo_settings`.
