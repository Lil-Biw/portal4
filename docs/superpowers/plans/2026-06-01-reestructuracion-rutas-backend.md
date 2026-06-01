# Reestructuración de Rutas Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestructurar las rutas del API de planas a jerárquicas (`/empresas/:id/centros/:id/proyectos`) para reflejar el dominio real, eliminar una brecha de seguridad en proyectos, y centralizar la autorización de acceso a empresa.

**Architecture:** Los controllers adoptan rutas anidadas (`@Controller('empresas/:empresaId/centros')`); los IDs de contexto (empresa, centro) vienen del path param en lugar de query params o body. Un nuevo guard `EmpresaAccessGuard` valida automáticamente que el usuario tenga acceso al `:empresaId` indicado. Los schemas y colecciones de MongoDB no se modifican.

**Tech Stack:** NestJS 10, Mongoose, class-validator, TypeScript. No hay test suite configurada — verificación manual con `curl` después de cada tarea.

---

## Mapa de rutas: antes → después

| Antes | Después |
|-------|---------|
| `GET /clientes` | `GET /empresas` |
| `GET /centros-costos?page=1` | `GET /empresas/:empresaId/centros` |
| `GET /activos?centro_costo_id=X` | `GET /empresas/:empresaId/centros/:centroId/activos` |
| `GET /proyectos?page=1` | `GET /empresas/:empresaId/centros/:centroId/proyectos` |
| `GET /mantenciones?centro_costo_id=X` | `GET /empresas/:empresaId/centros/:centroId/mantenciones` |
| `GET /solicitudes?empresa_id=X&centro_costo_id=Y` | `GET /empresas/:empresaId/solicitudes?centroId=Y` |

---

## Task 1: Guard de acceso a empresa

**Files:**
- Modify: `back4/src/common/guards/guards.ts`

- [ ] **Step 1: Agregar `EmpresaAccessGuard` al final de `guards.ts`**

```typescript
// Pegar al final de guards.ts, antes del último cierre

// ── EmpresaAccessGuard ────────────────────────────────────────────────────────
// Verifica que el usuario tenga acceso al :empresaId del route param.
// super_admin tiene acceso a todo. Usuarios normales solo a su propia empresa.
// Si la ruta no tiene :empresaId el guard deja pasar (para rutas sin contexto).

@Injectable()
export class EmpresaAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    if (user.rol === 'super_admin') return true;
    const empresaId = req.params['empresaId'];
    if (!empresaId) return true;
    return String(user.cliente_id) === String(empresaId);
  }
}
```

- [ ] **Step 2: Verificar que el archivo compila sin errores**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add back4/src/common/guards/guards.ts
git commit -m "feat: add EmpresaAccessGuard for hierarchical route authorization"
```

---

## Task 2: Renombrar `/clientes` → `/empresas`

**Files:**
- Modify: `back4/src/clientes/clientes.controller.ts`

- [ ] **Step 1: Cambiar el decorator `@Controller`**

En `clientes.controller.ts`, línea 1 del controller:
```typescript
// Antes:
@Controller('clientes')

// Después:
@Controller('empresas')
```

- [ ] **Step 2: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Verificar ruta**

```bash
# Iniciar servidor en otra terminal primero: npm run start:dev
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/empresas \
  -H "Authorization: Bearer <TOKEN>"
# Esperado: 200
```

- [ ] **Step 4: Commit**

```bash
git add back4/src/clientes/clientes.controller.ts
git commit -m "feat: rename /clientes route to /empresas"
```

---

## Task 3: Centros de costos bajo `/empresas/:empresaId/centros`

**Files:**
- Modify: `back4/src/centros-costos/centros-costos.controller.ts`
- Modify: `back4/src/centros-costos/centros-costos.dto.ts`

- [ ] **Step 1: Actualizar `CreateCentroCostoDto` — hacer `cliente_id` opcional (viene del route param)**

```typescript
// centros-costos.dto.ts
export class CreateCentroCostoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;  // opcional: viene del route param
  @IsString() @MinLength(2) codigo: string;
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsString() @IsOptional() ubicacion_direccion?: string;
  @IsString() @IsOptional() ubicacion_ciudad?: string;
  @IsString() @IsOptional() ubicacion_region?: string;
  @IsString() @IsOptional() ubicacion_pais?: string;
}
```

- [ ] **Step 2: Reescribir `centros-costos.controller.ts` completo**

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { CentrosCostosService } from './centros-costos.service';
import { CreateCentroCostoDto, UpdateCentroCostoDto, AgregarDocumentoDto } from './centros-costos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros')
@UseGuards(EmpresaAccessGuard)
export class CentrosCostosController {
  constructor(private readonly centrosCostosService: CentrosCostosService) {}

  @Post()
  @Roles('super_admin')
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateCentroCostoDto) {
    return this.centrosCostosService.create({ ...dto, cliente_id: empresaId });
  }

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.centrosCostosService.findAllByCliente(empresaId, +page, +limit);
  }

  @Get(':centroId')
  findOne(@Param('centroId') centroId: string) {
    return this.centrosCostosService.findOne(centroId);
  }

  @Put(':centroId')
  @Roles('super_admin')
  update(@Param('centroId') centroId: string, @Body() dto: UpdateCentroCostoDto) {
    return this.centrosCostosService.update(centroId, dto);
  }

  @Delete(':centroId')
  @Roles('super_admin')
  remove(@Param('centroId') centroId: string) {
    return this.centrosCostosService.remove(centroId);
  }

  @Post(':centroId/documentos')
  @Roles('super_admin')
  agregarDocumento(
    @Param('centroId') centroId: string,
    @Body() dto: AgregarDocumentoDto,
  ) {
    return this.centrosCostosService.agregarDocumento(centroId, dto);
  }

  @Delete(':centroId/documentos/:docId')
  @Roles('super_admin')
  eliminarDocumento(
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
  ) {
    return this.centrosCostosService.eliminarDocumento(centroId, docId);
  }
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add back4/src/centros-costos/centros-costos.controller.ts \
        back4/src/centros-costos/centros-costos.dto.ts
git commit -m "feat: nest centros-costos under /empresas/:empresaId/centros"
```

---

## Task 4: Activos bajo `/empresas/:empresaId/centros/:centroId/activos`

**Files:**
- Modify: `back4/src/activos/activos.controller.ts`
- Modify: `back4/src/activos/activos.dto.ts`

- [ ] **Step 1: Hacer `centro_costo_id` opcional en `CreateActivoDto`**

```typescript
// activos.dto.ts
import { IsString, IsOptional, IsMongoId, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateActivoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @MinLength(2) tipo_activo: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;  // viene del route param
  @IsString() @IsOptional() descripcion?: string;
}

export class UpdateActivoDto extends PartialType(CreateActivoDto) {}
```

- [ ] **Step 2: Reescribir `activos.controller.ts`**

```typescript
import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ActivosService } from './activos.service';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/activos')
@UseGuards(EmpresaAccessGuard)
export class ActivosController {
  constructor(private readonly activosService: ActivosService) {}

  @Get()
  findAll(@Param('centroId') centroId: string) {
    return this.activosService.findAll(centroId);
  }

  @Get(':activoId')
  findOne(@Param('activoId') activoId: string) {
    return this.activosService.findOne(activoId);
  }

  @Post()
  @Roles('super_admin')
  create(@Param('centroId') centroId: string, @Body() dto: CreateActivoDto) {
    return this.activosService.create({ ...dto, centro_costo_id: centroId });
  }

  @Put(':activoId')
  @Roles('super_admin')
  update(@Param('activoId') activoId: string, @Body() dto: UpdateActivoDto) {
    return this.activosService.update(activoId, dto);
  }

  @Delete(':activoId')
  @Roles('super_admin')
  remove(@Param('activoId') activoId: string) {
    return this.activosService.remove(activoId);
  }
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add back4/src/activos/activos.controller.ts \
        back4/src/activos/activos.dto.ts
git commit -m "feat: nest activos under /empresas/:empresaId/centros/:centroId/activos"
```

---

## Task 5: Proyectos bajo `/empresas/:empresaId/centros/:centroId/proyectos`

**Files:**
- Modify: `back4/src/proyectos/proyectos.controller.ts`
- Modify: `back4/src/proyectos/proyectos.dto.ts`

- [ ] **Step 1: Hacer `cliente_id` y `centro_costo_id` opcionales en `CreateProyectoDto`**

```typescript
// proyectos.dto.ts
import {
  IsString, IsOptional,
  IsMongoId, IsEnum, IsDateString, MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateProyectoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;       // viene de :empresaId
  @IsMongoId() @IsOptional() centro_costo_id?: string;  // viene de :centroId
  @IsString() @MinLength(2) codigo: string;
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsEnum(['borrador', 'activo', 'cerrado']) @IsOptional() estado?: 'borrador' | 'activo' | 'cerrado';
  @IsDateString() @IsOptional() fecha_inicio?: string;
  @IsDateString() @IsOptional() fecha_fin?: string;
}

export class UpdateProyectoDto extends PartialType(CreateProyectoDto) {}

export class AgregarDocumentoProyectoDto {
  @IsString() nombre: string;
  @IsString() url: string;
  @IsString() tipo_mime: string;
  @IsOptional() tamano_bytes?: number;
}
```

- [ ] **Step 2: Reescribir `proyectos.controller.ts`**

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto, UpdateProyectoDto, AgregarDocumentoProyectoDto } from './proyectos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/proyectos')
@UseGuards(EmpresaAccessGuard)
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  @Roles('super_admin')
  create(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Body() dto: CreateProyectoDto,
  ) {
    return this.proyectosService.create({
      ...dto,
      cliente_id: empresaId,
      centro_costo_id: centroId,
    });
  }

  @Get()
  findAll(
    @Param('centroId') centroId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.proyectosService.findAllByCentro(centroId, +page, +limit);
  }

  @Get(':proyectoId')
  findOne(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.findOne(proyectoId);
  }

  @Put(':proyectoId')
  @Roles('super_admin')
  update(@Param('proyectoId') proyectoId: string, @Body() dto: UpdateProyectoDto) {
    return this.proyectosService.update(proyectoId, dto);
  }

  @Delete(':proyectoId')
  @Roles('super_admin')
  remove(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.remove(proyectoId);
  }

  @Post(':proyectoId/documentos')
  @Roles('super_admin')
  agregarDocumento(
    @Param('proyectoId') proyectoId: string,
    @Body() dto: AgregarDocumentoProyectoDto,
  ) {
    return this.proyectosService.agregarDocumento(proyectoId, dto);
  }

  @Delete(':proyectoId/documentos/:docId')
  @Roles('super_admin')
  eliminarDocumento(
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
  ) {
    return this.proyectosService.eliminarDocumento(proyectoId, docId);
  }
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add back4/src/proyectos/proyectos.controller.ts \
        back4/src/proyectos/proyectos.dto.ts
git commit -m "feat: nest proyectos under /empresas/:empresaId/centros/:centroId/proyectos — fixes security gap"
```

---

## Task 6: Mantenciones bajo `/empresas/:empresaId/centros/:centroId/mantenciones`

**Files:**
- Modify: `back4/src/mantenciones/mantenciones.controller.ts`
- Modify: `back4/src/mantenciones/mantenciones.dto.ts`

- [ ] **Step 1: Hacer `centro_costo_id` opcional en `CreateMantencionDto`**

```typescript
// mantenciones.dto.ts
import { IsString, IsOptional, IsMongoId, IsDateString, MinLength, IsArray } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateMantencionDto {
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() tipo_id: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;  // viene del route param
  @IsArray() @IsMongoId({ each: true }) @IsOptional() activo_ids?: string[];
  @IsDateString() fecha: string;
}

export class UpdateMantencionDto extends PartialType(CreateMantencionDto) {}
```

- [ ] **Step 2: Reescribir `mantenciones.controller.ts`**

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Res, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MantencionesService } from './mantenciones.service';
import { CreateMantencionDto, UpdateMantencionDto } from './mantenciones.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/mantenciones')
@UseGuards(EmpresaAccessGuard)
export class MantencionesController {
  constructor(private readonly service: MantencionesService) {}

  @Get()
  findAll(
    @Param('centroId') centroId: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.findAll(centroId, desde, hasta);
  }

  @Get(':mantencionId')
  findOne(@Param('mantencionId') mantencionId: string) {
    return this.service.findOne(mantencionId);
  }

  @Post()
  @Roles('super_admin')
  create(@Param('centroId') centroId: string, @Body() dto: CreateMantencionDto) {
    return this.service.create({ ...dto, centro_costo_id: centroId });
  }

  @Put(':mantencionId')
  @Roles('super_admin')
  update(@Param('mantencionId') mantencionId: string, @Body() dto: UpdateMantencionDto) {
    return this.service.update(mantencionId, dto);
  }

  @Delete(':mantencionId')
  @Roles('super_admin')
  remove(@Param('mantencionId') mantencionId: string) {
    return this.service.remove(mantencionId);
  }

  @Post(':mantencionId/documentos')
  @Roles('super_admin')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @Param('mantencionId') mantencionId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.service.subirDocumento(mantencionId, archivo, nombreDisplay);
  }

  @Delete(':mantencionId/documentos/:nombre')
  @Roles('super_admin')
  eliminarDocumento(
    @Param('mantencionId') mantencionId: string,
    @Param('nombre') nombre: string,
  ) {
    return this.service.eliminarDocumento(mantencionId, nombre);
  }

  @Get(':mantencionId/documentos/:nombre')
  async descargarDocumento(
    @Param('mantencionId') mantencionId: string,
    @Param('nombre') nombre: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.service.servirDocumento(mantencionId, nombre);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre_display)}"`);
    res.send(buffer);
  }
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add back4/src/mantenciones/mantenciones.controller.ts \
        back4/src/mantenciones/mantenciones.dto.ts
git commit -m "feat: nest mantenciones under /empresas/:empresaId/centros/:centroId/mantenciones"
```

---

## Task 7: Solicitudes bajo `/empresas/:empresaId/solicitudes`

**Files:**
- Modify: `back4/src/solicitudes/solicitudes.controller.ts`
- Modify: `back4/src/solicitudes/solicitudes.dto.ts`

- [ ] **Step 1: Hacer `empresa_id` opcional en `CreateSolicitudDto`**

```typescript
// solicitudes.dto.ts
import { IsString, IsOptional, IsMongoId, IsEnum, MinLength, MaxLength } from 'class-validator';

export class CreateSolicitudDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @MaxLength(100) tipo: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() @IsOptional() empresa_id?: string;       // viene del route param
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsMongoId() @IsOptional() proyecto_id?: string;
}

export class UpdateSolicitudDto {
  @IsString() @MinLength(2) @IsOptional() nombre?: string;
  @IsString() @MaxLength(100) @IsOptional() tipo?: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class CambiarEstadoDto {
  @IsEnum(['pendiente', 'revision', 'aprobado', 'rechazado', 'vencido']) estado: string;
  @IsString() @IsOptional() motivo_rechazo?: string;
}
```

- [ ] **Step 2: Reescribir `solicitudes.controller.ts`**

```typescript
import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto, UpdateSolicitudDto, CambiarEstadoDto } from './solicitudes.dto';
import { EmpresaAccessGuard } from '../common/guards/guards';

@Controller('empresas/:empresaId/solicitudes')
@UseGuards(EmpresaAccessGuard)
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateSolicitudDto) {
    return this.solicitudesService.create({ ...dto, empresa_id: empresaId });
  }

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('centroId') centroId?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('estado') estado?: string,
  ) {
    return this.solicitudesService.findByContexto(empresaId, centroId, proyectoId, estado);
  }

  @Patch(':solicitudId')
  update(@Param('solicitudId') solicitudId: string, @Body() dto: UpdateSolicitudDto) {
    return this.solicitudesService.update(solicitudId, dto);
  }

  @Delete(':solicitudId')
  remove(@Param('solicitudId') solicitudId: string) {
    return this.solicitudesService.remove(solicitudId);
  }

  @Put(':solicitudId/estado')
  cambiarEstado(@Param('solicitudId') solicitudId: string, @Body() dto: CambiarEstadoDto) {
    return this.solicitudesService.cambiarEstado(solicitudId, dto);
  }

  @Post(':solicitudId/adjuntar')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  adjuntar(
    @Param('solicitudId') solicitudId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.solicitudesService.adjuntarArchivo(solicitudId, archivo);
  }
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add back4/src/solicitudes/solicitudes.controller.ts \
        back4/src/solicitudes/solicitudes.dto.ts
git commit -m "feat: nest solicitudes under /empresas/:empresaId/solicitudes"
```

---

## Task 8: Verificación final e inicio del servidor

**Files:** ninguno — solo verificación

- [ ] **Step 1: Build completo sin errores**

```bash
cd back4 && npm run build 2>&1 | tail -20
# Esperado: "Successfully compiled"
```

- [ ] **Step 2: Iniciar servidor en dev**

```bash
cd back4 && npm run start:dev
# Esperado: "Nest application successfully started"
```

- [ ] **Step 3: Verificar rutas clave con curl**

Obtener token primero:
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<EMAIL>","password":"<PASS>"}' | jq -r '.access_token')
```

Verificar empresas:
```bash
curl -s http://localhost:3000/api/empresas \
  -H "Authorization: Bearer $TOKEN" | jq '.total'
# Esperado: número de empresas
```

Verificar centros de una empresa:
```bash
EMPRESA_ID="<ID>"
curl -s http://localhost:3000/api/empresas/$EMPRESA_ID/centros \
  -H "Authorization: Bearer $TOKEN" | jq '.total'
# Esperado: número de centros
```

Verificar proyectos de un centro:
```bash
CENTRO_ID="<ID>"
curl -s http://localhost:3000/api/empresas/$EMPRESA_ID/centros/$CENTRO_ID/proyectos \
  -H "Authorization: Bearer $TOKEN" | jq '.total'
# Esperado: número de proyectos (antes devolvía TODOS los proyectos sin filtro)
```

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git add -p
git commit -m "fix: post-restructuring adjustments"
```
