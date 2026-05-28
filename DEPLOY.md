# Guía de despliegue — PORTAL4

> **ANTES DE DESPLEGAR** revisar `PORTAL4_problemas.md`. Issues críticos que bloquean producción:
> - `environment.prod.ts` apunta a `localhost:3000` — corregir con `set-env.js` + variable `API_URL`
> - `JWT_SECRET` en `.env` es débil — generar uno nuevo con `openssl rand -hex 64`
> - Credenciales SMTP en `.env` deben rotarse si el archivo fue compartido
> - Path traversal en módulo documentos — parchar antes de exponer al público

Frontend (Angular) y backend (NestJS) se despliegan por separado.

---

## 1. Base de datos — MongoDB Atlas

1. Crear cuenta en [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Crear cluster gratuito (M0)
3. Crear usuario y contraseña de base de datos
4. En **Network Access** → Add IP Address → `0.0.0.0/0` (acceso desde cualquier IP)
5. Copiar el **Connection String**: `mongodb+srv://<user>:<pass>@cluster.mongodb.net/portal_clientes`

---

## 2. Backend — Vercel

> **Nota**: el feature de **subida de documentos** guarda archivos en disco,
> lo cual no funciona en producción serverless (filesystem efímero).
> Para documentos en producción, integrar S3 o Cloudinary.
> El resto de la API (CRUD, usuarios, etc.) funciona correctamente en Vercel.

### Pasos

1. Ir a [vercel.com](https://vercel.com) → New Project → importar `PORTAL4/back4`
2. **Root Directory**: `back4`
3. **Framework Preset**: Other
4. En **Environment Variables** agregar:

| Variable | Valor |
|---|---|
| `MONGODB_URI` | `mongodb+srv://...` (de Atlas) |
| `JWT_SECRET` | string 64+ chars aleatorios (`openssl rand -hex 64`) |
| `CORS_ORIGIN` | URL del frontend (ej: `https://portal4-front.vercel.app`) |
| `NODE_ENV` | `production` |
| `MAIL_USER` | cuenta Gmail para notificaciones |
| `MAIL_PASS` | contraseña de app Gmail (no la contraseña de cuenta) |

5. Deploy → copiar la URL del backend (ej: `https://portal4-back.vercel.app`)

---

## 3. Frontend — Vercel

1. Ir a [vercel.com](https://vercel.com) → New Project → importar `PORTAL4/front4`
2. **Root Directory**: `front4`
3. **Framework Preset**: Other (el `vercel.json` ya configura todo)
4. En **Environment Variables** agregar:

| Variable | Valor |
|---|---|
| `API_URL` | URL del backend + `/api/v1` (ej: `https://portal4-back.vercel.app/api/v1`) |

5. Deploy

---

## 4. Alternativa recomendada para el backend: Railway

Railway es mejor opción para NestJS ya que soporta procesos persistentes y filesystem (para los uploads).

1. Ir a [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Seleccionar repo → **Root Directory**: `back4`
3. En Variables de entorno: las mismas que en el punto 2
4. Railway detecta automáticamente NestJS y usa `npm run start:prod`

---

## 5. Desarrollo local

```bash
# Backend
cd back4
cp .env.example .env   # completar MONGODB_URI
npm install
npm run start:dev      # http://localhost:3000/api/v1

# Frontend (en otra terminal)
cd front4
npm install
npm start              # http://localhost:4200
```
