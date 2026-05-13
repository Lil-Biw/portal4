# Portal Clientes — API NestJS

API REST construida con NestJS + MongoDB (Mongoose) para el Portal de Clientes.

## Setup rápido

```bash
npm install
cp .env.example .env      # Editar con tus valores
npm run start:dev
```

La API queda disponible en `http://localhost:3000/api/v1`

---

## Endpoints

### Auth
| Método | Ruta              | Descripción          | Acceso    |
|--------|-------------------|----------------------|-----------|
| POST   | /auth/login       | Login, devuelve JWT  | Público   |

### Clientes
| Método | Ruta              | Descripción          | Acceso         |
|--------|-------------------|----------------------|----------------|
| POST   | /clientes         | Crear cliente        | admin_cliente  |
| GET    | /clientes         | Listar clientes      | Autenticado    |
| GET    | /clientes/:id     | Ver cliente          | Autenticado    |
| PUT    | /clientes/:id     | Actualizar cliente   | admin_cliente  |
| DELETE | /clientes/:id     | Desactivar cliente   | admin_cliente  |

### Usuarios
| Método | Ruta                      | Descripción            | Acceso        |
|--------|---------------------------|------------------------|---------------|
| POST   | /usuarios                 | Crear usuario          | admin_cliente |
| GET    | /usuarios                 | Listar por cliente     | Autenticado   |
| GET    | /usuarios/:id             | Ver usuario            | Autenticado   |
| PUT    | /usuarios/:id             | Actualizar usuario     | admin_cliente |
| PATCH  | /usuarios/:id/password    | Cambiar contraseña     | Propio usuario|
| DELETE | /usuarios/:id             | Desactivar usuario     | admin_cliente |

### Centros de costos
| Método | Ruta                                      | Descripción          | Acceso              |
|--------|-------------------------------------------|----------------------|---------------------|
| POST   | /centros-costos                           | Crear centro         | admin_cliente       |
| GET    | /centros-costos                           | Listar por cliente   | Autenticado         |
| GET    | /centros-costos/:id                       | Ver centro           | Permiso ver/editar  |
| PUT    | /centros-costos/:id                       | Actualizar centro    | Permiso editar      |
| DELETE | /centros-costos/:id                       | Desactivar centro    | admin_cliente       |
| POST   | /centros-costos/:centroCostoId/documentos | Agregar documento    | Permiso editar      |
| DELETE | /centros-costos/:centroCostoId/documentos/:docId | Eliminar doc  | Permiso editar      |

### Proyectos
| Método | Ruta                              | Descripción          | Acceso             |
|--------|-----------------------------------|----------------------|--------------------|
| POST   | /proyectos                        | Crear proyecto       | Permiso editar     |
| GET    | /proyectos?centroCostoId=xxx      | Listar por centro    | Autenticado        |
| GET    | /proyectos/:id                    | Ver proyecto         | Autenticado        |
| PUT    | /proyectos/:id                    | Actualizar proyecto  | Permiso editar     |
| DELETE | /proyectos/:id                    | Cerrar proyecto      | admin_cliente      |
| POST   | /proyectos/:id/documentos         | Agregar documento    | Autenticado        |
| DELETE | /proyectos/:id/documentos/:docId  | Eliminar documento   | Autenticado        |

### Permisos
| Método | Ruta                                          | Descripción              | Acceso        |
|--------|-----------------------------------------------|--------------------------|---------------|
| POST   | /permisos                                     | Asignar/actualizar       | admin_cliente |
| GET    | /permisos/usuario/:usuarioId                  | Permisos de un usuario   | admin_cliente |
| GET    | /permisos/centro/:centroId                    | Usuarios de un centro    | admin_cliente |
| DELETE | /permisos/usuario/:usuarioId/centro/:centroId | Revocar permiso          | admin_cliente |

---

## Estructura de carpetas

```
src/
├── main.ts
├── app.module.ts
├── auth/
│   └── auth.module.ts          # Login, JWT, strategy
├── clientes/
│   └── clientes.module.ts      # Schema + DTO + Service + Controller
├── usuarios/
│   └── usuarios.module.ts
├── centros-costos/
│   └── centros-costos.module.ts
├── proyectos/
│   └── proyectos.module.ts
├── permisos/
│   └── permisos.module.ts
└── common/
    └── guards/
        └── guards.ts           # JwtAuthGuard, RolesGuard, PermisosGuard
```

## Guards disponibles

- `JwtAuthGuard` — requiere token JWT válido
- `RolesGuard` + `@Roles('admin_cliente')` — restringe por rol
- `PermisosGuard` + `@RequierePermiso('ver'|'editar')` — verifica permiso sobre el centro de costos en `:centroCostoId` o `:id`

## Ejemplo de uso

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.cl","password":"mipassword"}'

# Crear centro de costos (con token)
curl -X POST http://localhost:3000/api/v1/centros-costos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"cliente_id":"...","codigo":"CC-001","nombre":"Obras Civiles"}'

# Asignar permiso de edición
curl -X POST http://localhost:3000/api/v1/permisos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"usuario_id":"...","centro_costo_id":"...","tipo":"editar"}'
```
