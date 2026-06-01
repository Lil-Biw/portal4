# Documentos en MongoDB — Diseño

**Fecha:** 2026-06-01
**Branch:** feat/restructuracion-rutas

## Objetivo

Mover todo el almacenamiento de archivos del filesystem (`uploads/`) a MongoDB, usando `Buffer` embebido en cada colección. Eliminar el módulo `documentos` y remover dependencias de `fs` del código de producción. Requisito para que el backend funcione correctamente en Vercel.

## Patrón de referencia

`mantenciones` ya almacena archivos como `contenido: Buffer` en MongoDB y sirve los archivos con un endpoint `GET`. Este mismo patrón se aplica a todos los módulos restantes.

---

## Cambios por módulo

### 1. Empresas (`clientes`)

**Schema — campo nuevo:**
```ts
logo?: {
  contenido: Buffer;
  tipo_mime: string;
  nombre: string;
}
```
Reemplaza `logo_url?: string`.

**Endpoints:**
- `POST /api/v1/empresas/:id/logo` — sube logo (multipart/form-data, campo `archivo`)
- `GET  /api/v1/empresas/:id/logo` — sirve el logo con el `Content-Type` correcto

**Service:** `subirLogo(id, archivo)` guarda en DB, sin tocar disco.

---

### 2. Centros de Costos

**Schema — subdocumento `Documento` actualizado:**
```ts
class Documento {
  nombre: string;          // identificador interno único (timestamp_rand_originalname)
  nombre_display: string;  // nombre visible al usuario
  tipo_mime: string;
  tamano_bytes: number;
  contenido: Buffer;       // reemplaza url: string
  subido_por?: ObjectId;
  subido_en: Date;
}
```

**Endpoints:**
- `POST   /api/v1/empresas/:eId/centros/:cId/documentos` — sube archivo (multipart)
- `GET    /api/v1/empresas/:eId/centros/:cId/documentos` — lista documentos (sin `contenido`)
- `GET    /api/v1/empresas/:eId/centros/:cId/documentos/:docId` — descarga archivo
- `DELETE /api/v1/empresas/:eId/centros/:cId/documentos/:docId` — elimina

**DTO `AgregarDocumentoDto`:** eliminar campo `url`, agregar `nombre_display?: string`.

---

### 3. Proyectos

**Schema — mismo patrón que centros:**
```ts
class Documento {
  nombre: string;
  nombre_display: string;
  tipo_mime: string;
  tamano_bytes?: number;
  contenido: Buffer;       // reemplaza url: string
  subido_por?: ObjectId;
  subido_en: Date;
}
```

**Endpoints:**
- `POST   /api/v1/empresas/:eId/centros/:cId/proyectos/:pId/documentos`
- `GET    /api/v1/empresas/:eId/centros/:cId/proyectos/:pId/documentos`
- `GET    /api/v1/empresas/:eId/centros/:cId/proyectos/:pId/documentos/:docId`
- `DELETE /api/v1/empresas/:eId/centros/:cId/proyectos/:pId/documentos/:docId`

---

### 4. Solicitudes

**Schema — campos actualizados:**
```ts
// Eliminar:
archivo_nombre?: string;
archivo_url?: string;

// Agregar:
adjunto?: {
  contenido: Buffer;
  tipo_mime: string;
  nombre: string;
}
```

**Endpoints:**
- `POST /api/v1/empresas/:eId/solicitudes/:sId/adjuntar` — mismo endpoint, ahora guarda en DB
- `GET  /api/v1/empresas/:eId/solicitudes/:sId/adjunto` — nuevo endpoint para descargar

---

## Módulo `documentos` — eliminación

El módulo `src/documentos/` se elimina completamente:
- `documentos.controller.ts`
- `documentos.service.ts`
- `documentos.module.ts`
- `documentos.dto.ts`

Se desregistra de `app.module.ts`.

---

## `main.ts`

Eliminar el bloque `useStaticAssets`:
```ts
// Eliminar esto:
if (process.env.NODE_ENV !== 'production') {
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads' });
}
```

---

## Carpeta `uploads/`

Se ignora desde git (ya en `.gitignore`). Los datos actuales son de prueba y se descartan. No hay migración.

---

## Reglas generales para todos los endpoints de descarga

- `select('-contenido')` en los `findAll` y `findOne` — nunca devolver el buffer en listados
- El buffer solo sale por el endpoint `GET .../documentos/:docId` con headers:
  - `Content-Type: <tipo_mime>`
  - `Content-Disposition: attachment; filename="<nombre_display>"`
- Mismo manejo de `Buffer` que mantenciones (compatibilidad con BSON Binary del driver)

---

## Lo que NO cambia

- Colecciones de MongoDB (mismo nombre)
- Lógica de negocio en los services (solo cambia cómo se almacena el archivo)
- Guards y autenticación
- Módulos: `tipos-mantencion`, `noticias`, `usuarios`, `auth`, `permisos`
- Mantenciones (ya usa Buffer, sin cambios)
