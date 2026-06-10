# Diseño: Roles admin_smartclarity y creación de administradores

**Fecha:** 2026-06-10  
**Rama:** feat/restructuracion-rutas

---

## Contexto

Actualmente el rol `admin_smartclarity` se vincula a una empresa (`cliente_id`) al momento de crearse, lo que restringe su visibilidad a esa empresa en la página de Usuarios. El nuevo modelo establece que `admin_smartclarity` es un administrador de la plataforma SmartClarity sin empresa asignada: ve todas las empresas y todos los usuarios, pero solo puede crear usuarios regulares. Solo el `super_admin` puede crear nuevos `admin_smartclarity`.

---

## Modelo de roles

| Rol | Crea admins | Crea usuarios | Ve todas las empresas |
|---|---|---|---|
| `super_admin` | ✅ | ✅ | ✅ |
| `admin_smartclarity` | ❌ | ✅ | ✅ |
| `usuario` | ❌ | ❌ | ❌ |

Los `admin_smartclarity` **no tienen `cliente_id`**. El campo ya es opcional en el schema de Mongoose, por lo que no hay cambio de schema.

---

## Frontend

### `usuarios-page.component.ts`

- Renombrar `esAdminCliente` → `esAdminSmartclarity` (computed: `rol === 'admin_smartclarity'`).
- Añadir `esSuperAdmin` computed: `rol === 'super_admin'`.
- **Eliminar** el filtro por `cliente_id` en `clientesVisibles`, `centrosVisibles` y `usuariosVisibles`. Ambos roles admin ven todo sin filtro.
- `ngOnInit`: eliminar la bifurcación `cargarPorEmpresa`; siempre llamar `centrosService.cargar()`.
- `ModalMode`: añadir `'crear-admin'` → `'crear-admin' | 'crear-usuario' | 'editar' | 'buscar' | null`.
  - `'crear'` existente se renombra a `'crear-usuario'` para claridad.
- Añadir `abrirCrearAdmin()` y `crearAdmin(nombre, email)` que envía `{ nombre, email, rol: 'admin_smartclarity' }` sin `cliente_id`.
- En `crear()` (crear usuario): eliminar la inyección forzada de `cliente_id` del admin actual, ya que el form siempre recibe la empresa seleccionada.

### `usuarios-page.component.html`

**Header — botones condicionales:**
```
super_admin:        [Crear Administrador]  [Crear Usuario]  [Buscar]
admin_smartclarity:                        [Crear Usuario]  [Buscar]
```

**Modal "Crear Administrador"** — formulario inline mínimo (no usa `UsuarioFormComponent`):
- Campo: Nombre (requerido)
- Campo: Email (requerido, type email)
- Sin selector de empresa, rol fijo `admin_smartclarity`, sin centros, sin permiso_acceso.

**Modal "Crear Usuario"** — sin cambios, usa `UsuarioFormComponent` existente.

---

## Backend

### `guards.ts`

Revisar guards que leen `req.user.cliente_id` para filtrar queries. Si algún guard fuerza `cliente_id` como requerido para `admin_smartclarity`, debe permitir `undefined`/`null` sin error (acceso sin restricción de empresa).

### Schema / DTOs

Sin cambios: `cliente_id` ya es opcional en `UsuarioSchema` y en `CreateUsuarioDto`.

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `front4/src/app/features/usuarios/pages/usuarios-page.component.ts` | Nuevos computeds, modal mode, métodos crearAdmin |
| `front4/src/app/features/usuarios/pages/usuarios-page.component.html` | Botones condicionales, modal crear-admin |
| `back4/src/common/guards/guards.ts` | Revisar cliente_id undefined para admin_smartclarity |

---

## Fuera de alcance

- Cambios en la página de login o flujo de autenticación.
- Envío de email de bienvenida/contraseña (pendiente para otra iteración).
- Cambios en otros módulos (activos, centros, proyectos) — los guards de esos módulos se revisan solo si están relacionados con `cliente_id` de admin.
