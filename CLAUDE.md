# PORTAL4 — Portal de Clientes ECLARITI

Monorepo con backend y frontend desplegados por separado.

```
portal4/
├── back4/    # API REST — NestJS 10 + Mongoose 8 + MongoDB Atlas + S3 (ver back4/CLAUDE.md)
├── front4/   # SPA — Angular 21 standalone + signals (ver front4/CLAUDE.md)
├── docs/     # Specs y planes de diseño históricos (superpowers)
└── DEPLOY.md # Guía de despliegue (Vercel / EC2 / Railway)
```

## Arranque rápido

```bash
# Terminal 1 — Backend
cd back4 && cp .env.example .env   # completar variables
npm install && npm run start:dev   # http://localhost:3000/api/v1

# Terminal 2 — Frontend
cd front4
npm install && npm start           # http://localhost:4200
```

## Conceptos transversales

- **Roles:** `super_admin` (Eclarity, acceso total) · `admin_smartclarity` (admin interno con restricciones) · `usuario` (consumidor, atado a un `cliente_id`).
- **Modos del frontend:** `admin` (gestión interna) y `consumidor` (vista de cliente). El super_admin puede alternar entre ambos.
- **Nomenclatura:** la FK de cliente en solicitudes y rutas anidadas se llama `empresa_id`/`empresaId` (no `cliente_id`). Es intencional en back y front.
- **Archivos:** los documentos viven en Amazon S3; Mongo guarda solo metadata + `s3_key` en colecciones `doc_*`. El logo de cliente y las imágenes de noticias siguen como Buffer en Mongo.
- **Rutas anidadas:** el patrón de API es `/empresas/:empresaId/centros/:centroId/...` protegido por `EmpresaAccessGuard`.

## CI/CD

`.github/workflows/sync-vercel-repos.yml`: al hacer push a `main` sincroniza `back4/` → repo `portal4back4` y `front4/` → repo `portal4front4` (deploy automático en Vercel). Requiere el secret `SYNC_VERCEL`.

## Documentación

| Archivo | Contenido |
|---------|-----------|
| `back4/CLAUDE.md` | Arquitectura y convenciones del backend |
| `front4/CLAUDE.md` | Arquitectura y convenciones del frontend |
| `DEPLOY.md` | Despliegue (Atlas, Vercel, EC2, Railway) |
| `back4/tofix.md` | Problemas pendientes del backend |
| `front4/tofix.md` | Problemas pendientes del frontend |
