# Guía de despliegue — PORTAL4 (actualizada 2026-06-02)

> Generada a partir del análisis del código actual en `feat/restructuracion-rutas`.
> Reemplaza a `DEPLOY.md` — ver sección **Diferencias con DEPLOY.md** al final.

Frontend (Angular 21) y backend (NestJS 10) se despliegan por separado.
La base de datos vive en MongoDB Atlas (externa a ambos servicios).

---

## Estado actual del proyecto

### Issues de seguridad pendientes (revisar antes de producción)

| Severidad | Problema |
|-----------|----------|
| CRÍTICO | Cross-tenant data leak — documentos no validan `centroId` contra `empresaId` del JWT |
| CRÍTICO | Cambio de contraseña no verifica ownership correctamente |
| ALTO | Sin rate limiting en endpoint de login |
| MEDIO | JWT almacenado en `localStorage` (vulnerable a XSS) |
| MEDIO | Modo admin/consumidor manipulable desde DevTools |

---

## 1. Base de datos — MongoDB Atlas

Ya tienes Atlas configurado. Para un nuevo entorno:

1. Crear cluster (M0 gratuito o M10+ para producción)
2. Crear usuario con contraseña fuerte
3. En **Network Access** → Add IP Address → IP del servidor o `0.0.0.0/0`
4. Connection string: `mongodb+srv://<user>:<pass>@cluster.mongodb.net/portal_clientes?retryWrites=true&w=majority`

---

## 2. Backend — NestJS 10

### Variables de entorno (lista completa)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `MONGODB_URI` | Sí | Connection string de MongoDB Atlas |
| `JWT_SECRET` | Sí | Mínimo 64 chars aleatorios — `openssl rand -hex 64` |
| `CORS_ORIGIN` | Sí | URL(s) del frontend, separadas por coma. Ej: `https://portal4.vercel.app` |
| `NODE_ENV` | Sí | `production` |
| `MAIL_USER` | Sí | Cuenta Gmail para notificaciones |
| `MAIL_PASS` | Sí | Contraseña de app Gmail (no la contraseña de la cuenta) |
| `PORTAL_URL` | No | URL del frontend para links en emails. Default: `http://localhost:4200` |
| `PORT` | No | Puerto del servidor. Default: `3000` (Vercel lo ignora) |

> Generar JWT_SECRET: `openssl rand -hex 64`
> Generar contraseña de app Gmail: https://myaccount.google.com/apppasswords

### Notas clave

- **Archivos/uploads**: almacenados como Buffers en MongoDB. No hay filesystem local. Vercel compatible sin restricciones.
- **Vercel handler**: `back4/api/index.ts` — ya configurado en `back4/vercel.json`
- **Build**: `nest build` → output en `dist/`
- **Comando producción**: `node dist/main`

### Opción A — Vercel (recomendada, ya configurado)

El repo tiene `back4/vercel.json` listo. Solo importar y configurar variables.

1. Ir a [vercel.com](https://vercel.com) → New Project → importar `back4/`
2. **Root Directory**: `back4`
3. **Framework Preset**: Other
4. Agregar variables de entorno (tabla arriba)
5. Deploy → copiar URL (ej: `https://portal4-back.vercel.app`)

### Opción B — EC2 con PM2 + Nginx

```bash
# En EC2 (Ubuntu)
cd /home/ubuntu/portal4/back4
npm install
npm run build

# Crear .env
cat > .env << 'EOF'
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/portal_clientes
JWT_SECRET=<openssl rand -hex 64>
PORT=3000
CORS_ORIGIN=http://<IP-o-dominio>
NODE_ENV=production
MAIL_USER=<gmail>
MAIL_PASS=<app-password>
PORTAL_URL=http://<IP-o-dominio>
EOF

# Iniciar con PM2
pm2 start dist/main.js --name portal4-back
pm2 save && pm2 startup
```

### Opción C — Railway

1. New Project → Deploy from GitHub → Root Directory: `back4`
2. Mismas variables de entorno
3. Railway usa `npm run start:prod` automáticamente

---

## 3. Frontend — Angular 21

### Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `API_URL` | Sí | URL del backend + `/api/v1`. Ej: `https://portal4-back.vercel.app/api/v1` |

> El script `scripts/set-env.js` se ejecuta antes de `ng build` e inyecta `API_URL`
> en `src/environments/environment.prod.ts`. Si `API_URL` no está definida en
> `NODE_ENV=production`, el build falla con error explícito.

### Notas clave

- **Output directory**: `dist/portal3/browser` (definido en `vercel.json` del frontend)
- **SPA routing**: `vercel.json` redirige todo a `/index.html`
- **Build command**: `npm run build` (incluye `set-env.js` automáticamente)

### Opción A — Vercel (recomendada, ya configurado)

El repo tiene `front4/vercel.json` listo.

1. Ir a [vercel.com](https://vercel.com) → New Project → importar `front4/`
2. **Root Directory**: `front4`
3. **Framework Preset**: Other
4. Agregar variable: `API_URL=https://portal4-back.vercel.app/api/v1`
5. Deploy

### Opción B — EC2 con Nginx

```bash
# En EC2
cd /home/ubuntu/portal4/front4
npm install

export API_URL=http://<IP-o-dominio>/api/v1
node scripts/set-env.js
npm run build

# Copiar al directorio de Nginx
sudo mkdir -p /var/www/portal4
sudo cp -r dist/portal3/browser/* /var/www/portal4/
```

**Configuración Nginx** (`/etc/nginx/sites-available/portal4`):

```nginx
server {
    listen 80;
    server_name <IP-o-dominio>;

    # Frontend Angular (SPA)
    root /var/www/portal4;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/portal4 /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx && sudo systemctl enable nginx
```

**Puertos a abrir en Security Group de AWS:**

| Puerto | Protocolo | Origen |
|--------|-----------|--------|
| 22 | TCP | Tu IP |
| 80 | TCP | 0.0.0.0/0 |
| 443 | TCP | 0.0.0.0/0 |

No abrir el 3000 — solo Nginx accede al backend.

---

## 4. CI/CD — GitHub Actions (ya configurado)

El repo tiene `.github/workflows/sync-vercel-repos.yml` que al hacer push a `main`:

- Sincroniza `back4/` → repo `portal4back4` (Vercel backend)
- Sincroniza `front4/` → repo `portal4front4` (Vercel frontend)

Secrets necesarios en GitHub: `SYNC_VERCEL` (token con permisos de repo).

---

## 5. Desarrollo local

```bash
# Terminal 1 — Backend
cd back4
cp .env.example .env   # completar variables
npm install
npm run start:dev      # http://localhost:3000/api/v1

# Terminal 2 — Frontend
cd front4
npm install
npm start              # http://localhost:4200
```

El frontend en desarrollo usa `http://localhost:3000/api/v1` directamente (sin set-env.js).

---

## Diferencias con DEPLOY.md (versión anterior)

| Tema | DEPLOY.md (obsoleto) | DEPLOY2.md (actual) |
|------|----------------------|---------------------|
| **Uploads/archivos** | Guardados en disco (`back4/uploads/`), advertencia de incompatibilidad con Vercel | Almacenados como Buffers en MongoDB — sin filesystem, 100% compatible con Vercel |
| **Directorio de build frontend** | `dist/front4/browser` (incorrecto) | `dist/portal3/browser` (según `vercel.json` real) |
| **Variable `PORTAL_URL`** | No mencionada | Documentada — usada en templates de email |
| **Issues de seguridad** | 4 issues (environment.prod, JWT débil, SMTP, path traversal) | 5 issues actualizados — path traversal corregido, nuevos issues identificados |
| **Alternativa Railway** | Recomendada por filesystem de uploads | Sigue siendo válida pero uploads ya no son limitante |
| **CI/CD GitHub Actions** | No mencionado | Documentado — sync automático a repos Vercel |
| **Nginx `/uploads`** | Location `/uploads/` apuntando a directorio local | Eliminado — no existe directorio de uploads |
| **Opción EC2** | No incluida | Incluida como Opción B en backend y frontend |
