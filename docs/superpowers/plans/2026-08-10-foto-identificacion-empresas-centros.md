# Foto de identificación en empresas y centros de costo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una fotografía real de identificación de la empresa en "Mi ficha", y construir de punta a punta (schema, endpoints, admin, consumidor) el mismo mecanismo para centros de costo, mostrando su foto en el listado y detalle de "Mis centros".

**Architecture:** Se replica exactamente el patrón ya existente de `Cliente.logo` (Buffer en Mongo + endpoint `POST`/`GET` dedicado que sirve el binario inline) para un nuevo campo `foto` en `CentroCosto`. El único ajuste estructural es que `EmpresaAccessGuard` debe aprender a respetar `@Public()` (hoy no lo hace), porque el controller de centros lo aplica a nivel de clase y bloquearía el nuevo endpoint público de foto.

**Tech Stack:** NestJS 10 + Mongoose 8 + Multer (memoryStorage) en el backend; Angular 21 standalone + signals en el frontend.

## Global Constraints

- Sin `any` en código de producción (back4/CLAUDE.md).
- Nombres de tokens de Mongoose siempre como string (`'CentroCosto'`), nunca la clase directa.
- `PartialType` para DTOs de update — no aplica aquí porque `foto` no viaja en el DTO JSON (se sube vía `multipart/form-data` en un endpoint dedicado, igual que `logo` de cliente).
- Angular: solo control flow nativo (`@if`, `@for`) — nunca `*ngIf`/`*ngFor` mezclado (front4/CLAUDE.md).
- Signals para estado reactivo, no `BehaviorSubject`/`Subject`.
- `asId()` obligatorio al comparar ObjectIds entre entidades.
- Subida de archivos: `@UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))`, reusando la constante compartida — nunca opciones de multer duplicadas.
- El proyecto no tiene jest en back4 (solo scripts `ts-node` ad-hoc) ni specs para este tipo de flujo de subida en front4 — la verificación de cada tarea es manual (build + curl / navegador), seguiendo el mismo criterio que ya documenta el spec para `logo`/`foto`.

---

### Task 1: `EmpresaAccessGuard` debe respetar `@Public()`

**Contexto para quien implemente:** `CentrosCostosController` aplica `@UseGuards(EmpresaAccessGuard)` a nivel de clase (`back4/src/centros-costos/centros-costos.controller.ts:15-16`). Ese guard (`back4/src/common/guards/guards.ts:83-94`) hace `if (!user) return false;` sin mirar el metadato `@Public()`. El endpoint nuevo `GET :centroId/foto` que agregaremos en la Tarea 4 necesita ser público (para que un `<img src="...">` cargue sin token, igual que el logo de empresa) — pero como está dentro de esa misma clase, sin este fix quedaría bloqueado con 403 aunque se marque `@Public()`. Este fix es un prerrequisito de todo lo demás.

**Files:**
- Modify: `back4/src/common/guards/guards.ts:83-94`

**Interfaces:**
- Produces: `EmpresaAccessGuard` deja pasar cualquier request cuyo handler o clase tenga el metadato `IS_PUBLIC_KEY` (seteado por el decorador `@Public()`), sin exigir `req.user`.

- [ ] **Step 1: Modificar el guard**

Reemplazar el bloque completo de `EmpresaAccessGuard` en `back4/src/common/guards/guards.ts`:

```ts
// ── EmpresaAccessGuard ────────────────────────────────────────────────────────────
// Verifica que el usuario tenga acceso al :empresaId del route param.
// super_admin tiene acceso a todo. Usuarios normales solo a su propia empresa.
// Si la ruta no tiene :empresaId el guard deja pasar (para rutas sin contexto).
// Las rutas marcadas con @Public() quedan exentas (igual criterio que JwtAuthGuard).

@Injectable()
export class EmpresaAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    if (user.rol === 'super_admin' || user.rol === 'admin_smartclarity') return true;
    const empresaId = req.params['empresaId'];
    if (!empresaId) return true;
    return String(user.cliente_id) === String(empresaId);
  }
}
```

No hace falta importar nada nuevo: `Reflector` e `IS_PUBLIC_KEY` ya están importados/declarados en la parte superior del mismo archivo (`import { Reflector } from '@nestjs/core';` en la línea 2, `IS_PUBLIC_KEY` declarado en la línea 9).

- [ ] **Step 2: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add back4/src/common/guards/guards.ts
git commit -m "fix: EmpresaAccessGuard respeta @Public() para permitir endpoints públicos anidados"
```

---

### Task 2: Campo `foto` en el schema de `CentroCosto`

**Files:**
- Modify: `back4/src/centros-costos/centros-costos.schema.ts`
- Modify: `back4/src/centros-costos/centros-costos.service.ts` (métodos `findAll`, `findAllByCliente`, `findOne`, `update` — excluir el binario)

**Interfaces:**
- Produces: `CentroCosto.foto?: { contenido: Buffer; tipo_mime: string; nombre: string }` — mismo shape que `Cliente.logo`.

- [ ] **Step 1: Agregar el campo al schema**

En `back4/src/centros-costos/centros-costos.schema.ts`, agregar la propiedad justo antes de `score_smartclarity`:

```ts
@Schema({ collection: 'centros_costos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class CentroCosto {
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ required: true, trim: true }) codigo: string;
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ trim: true }) ubicacion_direccion?: string;
  @Prop({ trim: true }) ubicacion_ciudad?: string;
  @Prop({ trim: true }) ubicacion_region?: string;
  @Prop({ trim: true }) ubicacion_pais?: string;
  @Prop() ubicacion_latitud?: number;
  @Prop() ubicacion_longitud?: number;
  @Prop({ default: true }) activo: boolean;
  @Prop({
    type: {
      contenido: Buffer,
      tipo_mime: String,
      nombre: String,
    },
  })
  foto?: { contenido: Buffer; tipo_mime: string; nombre: string };
  @Prop({ type: [Number], default: [5, 5, 5, 5, 5] }) score_smartclarity: number[];
}
```

El campo se llama `foto` (no `logo`): es una fotografía real del lugar tomada por alguien, no un isotipo de marca — ver `docs/superpowers/specs/2026-08-10-foto-identificacion-empresas-centros-design.md`.

- [ ] **Step 2: Excluir el binario en las lecturas**

En `back4/src/centros-costos/centros-costos.service.ts`, agregar `.select('-foto.contenido')` en los 4 métodos de lectura/escritura que devuelven el documento completo:

```ts
async findAll(page = 1, limit = 20) {
  const filter = { activo: true };
  const [data, total] = await Promise.all([
    this.centroCostoModel.find(filter).select('-foto.contenido').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    this.centroCostoModel.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) };
}

async findAllByCliente(cliente_id: string, page = 1, limit = 20) {
  const filter = { cliente_id: new Types.ObjectId(cliente_id), activo: true };
  const [data, total] = await Promise.all([
    this.centroCostoModel.find(filter).select('-foto.contenido').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    this.centroCostoModel.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) };
}
```

```ts
async findOne(id: string) {
  const centro = await this.centroCostoModel.findById(id).select('-foto.contenido').lean();
  if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
  return centro;
}
```

```ts
async update(id: string, dto: UpdateCentroCostoDto) {
  const payload: Record<string, unknown> = { ...dto };
  if (dto.cliente_id) payload['cliente_id'] = this.toObjectId(dto.cliente_id);
  const centro = await this.centroCostoModel
    .findByIdAndUpdate(id, payload, { new: true })
    .select('-foto.contenido')
    .lean();
  if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
  return centro;
}
```

(`findByIds`, `remove` y `updateScoreSmartclarity` no se tocan — no exponen el documento completo al frontend de forma relevante para este cambio; `findByIds` es usado internamente por otros módulos y no filtra el logo de cliente tampoco en su equivalente.)

- [ ] **Step 3: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add back4/src/centros-costos/centros-costos.schema.ts back4/src/centros-costos/centros-costos.service.ts
git commit -m "feat(back4): agregar campo foto a CentroCosto"
```

---

### Task 3: Métodos `subirFoto`/`servirFoto` en `CentrosCostosService`

**Files:**
- Modify: `back4/src/centros-costos/centros-costos.service.ts`

**Interfaces:**
- Consumes: `CentroCostoDocument` de `./centros-costos.schema` (ya importado).
- Produces:
  - `subirFoto(centroId: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }): Promise<CentroCosto>` — lanza `NotFoundException` si el centro no existe.
  - `servirFoto(centroId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }>` — lanza `NotFoundException` si el centro no existe o no tiene foto.

- [ ] **Step 1: Agregar los métodos**

Agregar en `back4/src/centros-costos/centros-costos.service.ts`, justo después de `updateScoreSmartclarity` (después de la línea 116, antes de `agregarDocumento`):

```ts
async subirFoto(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
  const centro = await this.centroCostoModel.findById(id).lean();
  if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
  return this.centroCostoModel
    .findByIdAndUpdate(
      id,
      { foto: { contenido: archivo.buffer, tipo_mime: archivo.mimetype, nombre: archivo.originalname } },
      { new: true, runValidators: false },
    )
    .select('-foto.contenido')
    .lean();
}

async servirFoto(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
  const centro = await this.centroCostoModel.findById(id).select('foto').lean();
  if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
  if (!centro.foto?.contenido) throw new NotFoundException('Este centro no tiene foto');
  const raw = centro.foto.contenido as unknown;
  let buffer: Buffer;
  if (Buffer.isBuffer(raw)) {
    buffer = raw;
  } else if (raw && typeof raw === 'object' && 'buffer' in (raw as object)) {
    const buf = (raw as { buffer: Buffer | ArrayBuffer }).buffer;
    buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  } else {
    buffer = Buffer.from(raw as ArrayBuffer);
  }
  return { buffer, tipo_mime: centro.foto.tipo_mime, nombre: centro.foto.nombre };
}
```

Este es exactamente el mismo manejo defensivo del tipo del `Buffer` que usa `ClientesService.servirLogo()` (`back4/src/clientes/clientes.service.ts:109-124`) — Mongo puede devolver `Binary` en vez de `Buffer` nativo según el driver.

- [ ] **Step 2: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso.

- [ ] **Step 3: Commit**

```bash
git add back4/src/centros-costos/centros-costos.service.ts
git commit -m "feat(back4): agregar subirFoto/servirFoto a CentrosCostosService"
```

---

### Task 4: Endpoints `POST`/`GET :centroId/foto`

**Files:**
- Modify: `back4/src/centros-costos/centros-costos.controller.ts`

**Interfaces:**
- Consumes: `CentrosCostosService.subirFoto` y `.servirFoto` (Tarea 3), `OPCIONES_SUBIDA` (`../common/constants/upload.constants`, ya importado en este archivo), `sendFile` (`../common/helpers/send-file.helper`, ya importado), `Public` (`../common/guards/guards`, agregar al import existente de `EmpresaAccessGuard, Roles`).
- Produces: `POST /empresas/:empresaId/centros/:centroId/foto` (multipart, campo `archivo`), `GET /empresas/:empresaId/centros/:centroId/foto` (público, sirve inline).

- [ ] **Step 1: Actualizar el import de guards**

En `back4/src/centros-costos/centros-costos.controller.ts:13`, cambiar:

```ts
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';
```

por:

```ts
import { EmpresaAccessGuard, Roles, Public } from '../common/guards/guards';
```

- [ ] **Step 2: Agregar los dos endpoints**

Agregar dentro de `CentrosCostosController` (`back4/src/centros-costos/centros-costos.controller.ts`), justo después de `updateScore` (después de la línea 53, antes de `remove`):

```ts
@Post(':centroId/foto')
@Roles('super_admin', 'admin_smartclarity')
@UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
subirFoto(
  @Param('centroId') centroId: string,
  @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
) {
  if (!archivo) throw new BadRequestException('No se proporcionó archivo');
  return this.centrosCostosService.subirFoto(centroId, archivo);
}

@Get(':centroId/foto')
@Public()
async servirFoto(@Param('centroId') centroId: string, @Res() res: Response) {
  const { buffer, tipo_mime, nombre } = await this.centrosCostosService.servirFoto(centroId);
  sendFile(res, buffer, tipo_mime, nombre, true);
}
```

Todos los símbolos usados (`Post`, `Roles`, `UseInterceptors`, `FileInterceptor`, `OPCIONES_SUBIDA`, `Param`, `UploadedFile`, `BadRequestException`, `Get`, `Public`, `Res`, `Response`, `sendFile`) ya están importados en el archivo por los endpoints existentes (`create`, `subirDocumento`, `descargarDocumento`) — no hace falta agregar imports salvo `Public` del Step 1.

- [ ] **Step 3: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso.

- [ ] **Step 4: Verificación manual con curl**

Con el backend corriendo (`npm run start:dev`) y un JWT de `super_admin` o `admin_smartclarity` válido en `$TOKEN`, y un `empresaId`/`centroId` reales de la base:

```bash
# Subir una foto de prueba
curl -X POST "http://localhost:3000/api/v1/empresas/$EMPRESA_ID/centros/$CENTRO_ID/foto" \
  -H "Authorization: Bearer $TOKEN" \
  -F "archivo=@/ruta/a/una/foto.jpg"

# Servirla de vuelta — SIN header de autorización, debe funcionar igual
curl -i "http://localhost:3000/api/v1/empresas/$EMPRESA_ID/centros/$CENTRO_ID/foto" -o /tmp/foto-descargada.jpg
```

Expected: el `POST` devuelve el centro actualizado (sin el binario). El `GET` sin token responde `200` con `Content-Type: image/jpeg` (o el mime correspondiente) y guarda la imagen correctamente en `/tmp/foto-descargada.jpg` — confirma que la Tarea 1 solucionó el bloqueo de `EmpresaAccessGuard`.

- [ ] **Step 5: Commit**

```bash
git add back4/src/centros-costos/centros-costos.controller.ts
git commit -m "feat(back4): endpoints POST/GET foto de centro de costo"
```

---

### Task 5: Modelo `CentroCosto` en el frontend

**Files:**
- Modify: `front4/src/app/shared/models/centro.model.ts`

**Interfaces:**
- Produces: `CentroCosto.foto?: { tipo_mime: string; nombre: string }`.

- [ ] **Step 1: Agregar el campo**

En `front4/src/app/shared/models/centro.model.ts`, agregar la propiedad a la interfaz `CentroCosto` (no a `CreateCentroDto`/`UpdateCentroDto` — igual que `logo` no está en `CreateClienteDto`, porque viaja por el endpoint multipart dedicado, no por el body JSON):

```ts
export interface CentroCosto {
  _id: string;
  cliente_id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  ubicacion_direccion?: string;
  ubicacion_ciudad?: string;
  ubicacion_region?: string;
  ubicacion_pais?: string;
  ubicacion_latitud?: number;
  ubicacion_longitud?: number;
  activo: boolean;
  foto?: { tipo_mime: string; nombre: string };
  score_smartclarity?: number[];
  creado_en?: string;
  actualizado_en?: string;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.json`
Expected: sin nuevos errores (puede haber warnings preexistentes no relacionados; confirmar que no aparecen errores en `centro.model.ts`).

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/shared/models/centro.model.ts
git commit -m "feat(front4): agregar campo foto al modelo CentroCosto"
```

---

### Task 6: Panel lateral de foto en `centro-form` (admin)

**Files:**
- Modify: `front4/src/app/features/centros/components/centro-form/centro-form.component.ts`
- Modify: `front4/src/app/features/centros/components/centro-form/centro-form.component.html`

**Interfaces:**
- Consumes: `ApiService.url(path)` (`../../../../core/services/api.service`), `CentroCosto` (ya importado).
- Produces: `@Output() fotoFile = new EventEmitter<File | null>()` — el padre (`centros-page.component.ts`, Tarea 7) escucha este evento igual que ya escucha `logoFile` en `cliente-form`.

- [ ] **Step 1: Actualizar el `.ts`**

Reemplazar el contenido completo de `front4/src/app/features/centros/components/centro-form/centro-form.component.ts`:

```ts
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CentroCosto, CreateCentroDto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { ApiService } from '../../../../core/services/api.service';

// Parsea "lat, lng" en formato decimal de Google Maps, ej: -38.758556, -72.609528
function parseDecimal(input: string): { lat: number; lng: number } | null {
  const m = input.trim().match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

@Component({
  selector: 'app-centro-form',
  standalone: true,
  imports: [FormsModule, NgFor],
  templateUrl: './centro-form.component.html',
})
export class CentroFormComponent implements OnChanges {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() initial: CentroCosto | null = null;
  @Input() clientes: Cliente[] = [];
  @Input() submitLabel = 'Guardar';
  @Output() submitted = new EventEmitter<CreateCentroDto>();
  @Output() fotoFile = new EventEmitter<File | null>();

  form: CreateCentroDto = this.empty();
  coordInput = '';
  coordError = '';
  previewMapUrl: SafeResourceUrl | null = null;
  tabUbicacion: 'direccion' | 'coordenadas' = 'direccion';
  fotoPreview: string | null = null;
  private _fotoFile: File | null = null;

  setTabUbicacion(tab: 'direccion' | 'coordenadas'): void {
    if (this.tabUbicacion === tab) return;
    this.tabUbicacion = tab;
    if (tab === 'coordenadas') {
      this.form.ubicacion_direccion = '';
      this.form.ubicacion_ciudad = '';
      this.form.ubicacion_region = '';
      this.form.ubicacion_pais = '';
    } else {
      this.form.ubicacion_latitud = undefined;
      this.form.ubicacion_longitud = undefined;
      this.coordInput = '';
      this.coordError = '';
      this.previewMapUrl = null;
    }
  }

  get puedePrevisualizar(): boolean {
    return this.form.ubicacion_latitud != null && this.form.ubicacion_longitud != null;
  }

  onCoordChange(): void {
    if (!this.coordInput.trim()) {
      this.form.ubicacion_latitud = undefined;
      this.form.ubicacion_longitud = undefined;
      this.coordError = '';
      this.previewMapUrl = null;
      return;
    }
    const result = parseDecimal(this.coordInput);
    if (result) {
      this.form.ubicacion_latitud = result.lat;
      this.form.ubicacion_longitud = result.lng;
      this.coordError = '';
    } else {
      this.form.ubicacion_latitud = undefined;
      this.form.ubicacion_longitud = undefined;
      this.coordError = 'Formato inválido. Pega las coordenadas de Google Maps, ej: -38.758556, -72.609528';
    }
    this.previewMapUrl = null;
  }

  verEnMapa(): void {
    const lat = this.form.ubicacion_latitud;
    const lng = this.form.ubicacion_longitud;
    if (lat == null || lng == null) return;
    this.previewMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://maps.google.com/maps?q=${lat},${lng}&output=embed&z=14`
    );
  }

  // El backend no devuelve el binario de la foto (solo tipo_mime/nombre, ver
  // centros-costos.service.ts findOne/findAllByCliente con .select('-foto.contenido'))
  // — hay que pedirla al endpoint dedicado GET /empresas/:empresaId/centros/:centroId/foto.
  private resolveFotoUrl(centro: CentroCosto | null): string | null {
    if (!centro?._id || !centro?.foto?.tipo_mime) return null;
    return this.api.url(`/empresas/${centro.cliente_id}/centros/${centro._id}/foto`);
  }

  onFotoSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this._fotoFile = file;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { this.fotoPreview = e.target?.result as string; this.cdr.markForCheck(); };
      reader.readAsDataURL(file);
    } else {
      this.fotoPreview = this.resolveFotoUrl(this.initial);
    }
  }

  ngOnChanges(): void {
    this.previewMapUrl = null;
    this.coordError = '';
    const lat = this.initial?.ubicacion_latitud;
    const lng = this.initial?.ubicacion_longitud;
    this.coordInput = (lat != null && lng != null) ? `${lat}, ${lng}` : '';
    this.tabUbicacion = (lat != null && lng != null) ? 'coordenadas' : 'direccion';
    this.form = this.initial
      ? {
          cliente_id: this.initial.cliente_id,
          codigo: this.initial.codigo,
          nombre: this.initial.nombre,
          descripcion: this.initial.descripcion ?? '',
          ubicacion_direccion: this.initial.ubicacion_direccion ?? '',
          ubicacion_ciudad: this.initial.ubicacion_ciudad ?? '',
          ubicacion_region: this.initial.ubicacion_region ?? '',
          ubicacion_pais: this.initial.ubicacion_pais ?? 'Chile',
          ubicacion_latitud: lat,
          ubicacion_longitud: lng,
        }
      : this.empty();
    this.fotoPreview = this.resolveFotoUrl(this.initial);
    this._fotoFile = null;
  }

  submit(): void {
    this.fotoFile.emit(this._fotoFile);
    this.submitted.emit(this.form);
  }

  private empty(): CreateCentroDto {
    return { cliente_id: '', codigo: '', nombre: '', descripcion: '', ubicacion_direccion: '', ubicacion_ciudad: '', ubicacion_region: '', ubicacion_pais: 'Chile', ubicacion_latitud: undefined, ubicacion_longitud: undefined };
  }
}
```

- [ ] **Step 2: Actualizar el `.html`**

Reemplazar el contenido completo de `front4/src/app/features/centros/components/centro-form/centro-form.component.html`:

```html
<form (ngSubmit)="submit()" style="display:grid;grid-template-columns:1fr 230px;gap:1.25rem;align-items:start">
  <div class="form-grid">
    <label class="field" style="grid-column:1/-1">
      <span>Empresa *</span>
      <select [(ngModel)]="form.cliente_id" name="cliente_id" required>
        <option value="">Selecciona una empresa</option>
        <option *ngFor="let c of clientes" [value]="c._id">{{ c.razon_social }}</option>
      </select>
    </label>
    <label class="field">
      <span>Código *</span>
      <input [(ngModel)]="form.codigo" name="codigo" required />
    </label>
    <label class="field">
      <span>Nombre *</span>
      <input [(ngModel)]="form.nombre" name="nombre" required />
    </label>
    <label class="field" style="grid-column:1/-1">
      <span>Descripción</span>
      <input [(ngModel)]="form.descripcion" name="descripcion" />
    </label>

    <!-- Tabs de ubicación -->
    <div style="grid-column:1/-1">
      <div style="display:flex;gap:0;border-bottom:2px solid rgba(34,33,33,.1);margin-bottom:1rem">
        <button
          type="button"
          (click)="setTabUbicacion('direccion')"
          style="padding:.55rem 1.1rem;border:none;background:none;cursor:pointer;font-size:.88rem;font-weight:600;font-family:inherit;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s,border-color .15s"
          [style.color]="tabUbicacion === 'direccion' ? '#0095d6' : '#6b7280'"
          [style.border-bottom-color]="tabUbicacion === 'direccion' ? '#0095d6' : 'transparent'">
          Dirección
        </button>
        <button
          type="button"
          (click)="setTabUbicacion('coordenadas')"
          style="padding:.55rem 1.1rem;border:none;background:none;cursor:pointer;font-size:.88rem;font-weight:600;font-family:inherit;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s,border-color .15s"
          [style.color]="tabUbicacion === 'coordenadas' ? '#0095d6' : '#6b7280'"
          [style.border-bottom-color]="tabUbicacion === 'coordenadas' ? '#0095d6' : 'transparent'">
          Coordenadas Google
        </button>
      </div>

      @if (tabUbicacion === 'direccion') {
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <label class="field">
            <span>Dirección</span>
            <input [(ngModel)]="form.ubicacion_direccion" name="direccion" />
          </label>
          <label class="field">
            <span>Ciudad</span>
            <input [(ngModel)]="form.ubicacion_ciudad" name="ciudad" />
          </label>
          <label class="field">
            <span>Región</span>
            <input [(ngModel)]="form.ubicacion_region" name="region" />
          </label>
          <label class="field">
            <span>País</span>
            <input [(ngModel)]="form.ubicacion_pais" name="pais" />
          </label>
        </div>
      }

      @if (tabUbicacion === 'coordenadas') {
        <div>
          <label class="field">
            <span>Coordenadas Google Maps</span>
            <input [(ngModel)]="coordInput" name="coord"
                   (ngModelChange)="onCoordChange()"
                   placeholder='ej. -38.758556, -72.609528' />
          </label>
          <small style="color:#6b7280;display:block;margin-top:.25rem;font-size:.78rem">Abre Google Maps → clic derecho en el punto → copia los números que aparecen</small>
          @if (coordError) {
            <small style="color:var(--color-danger,#dc3545);display:block;margin-top:.25rem">{{ coordError }}</small>
          }
          @if (puedePrevisualizar && !coordError) {
            <div style="margin-top:.5rem">
              <button type="button" class="btn-ghost btn-sm" (click)="verEnMapa()">
                Ver en mapa
              </button>
            </div>
          }
          @if (previewMapUrl) {
            <iframe [src]="previewMapUrl"
                    width="100%" height="240"
                    style="border:0;border-radius:8px;display:block;margin-top:8px"
                    allowfullscreen loading="lazy">
            </iframe>
          }
        </div>
      }
    </div>

    <div class="form-footer" style="grid-column:1/-1">
      <button type="submit" class="btn-primary">{{ submitLabel }}</button>
    </div>
  </div>

  <!-- Panel lateral: foto del centro -->
  <div style="border:1px solid rgba(34,33,33,.12);border-radius:10px;padding:.85rem;display:flex;flex-direction:column;gap:.65rem;background:#f9fafb">
    <span style="font-size:.75rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.03em">Foto del centro</span>
    <div style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;aspect-ratio:4/3;background:#fff;display:flex;align-items:center;justify-content:center">
      @if (fotoPreview) {
        <img [src]="fotoPreview" alt="Foto del centro" style="width:100%;height:100%;object-fit:cover" />
      } @else {
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      }
    </div>
    <label style="text-align:center;font-size:.78rem;font-weight:600;color:#0095d6;border:1px solid rgba(0,149,214,.35);background:rgba(0,149,214,.06);border-radius:8px;padding:.5rem;cursor:pointer">
      Cambiar foto
      <input type="file" accept="image/*" (change)="onFotoSelected($event)" style="display:none" />
    </label>
    <p style="margin:0;font-size:.7rem;color:#9ca3af;text-align:center;line-height:1.4">JPG o PNG · se muestra en el listado y en el detalle del centro</p>
  </div>
</form>
```

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos en `centro-form.component.ts`.

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/centros/components/centro-form/centro-form.component.ts front4/src/app/features/centros/components/centro-form/centro-form.component.html
git commit -m "feat(front4): panel lateral de foto en el formulario de centro de costo"
```

---

### Task 7: Subida de foto desde `centros.service.ts` y wiring en `centros-page.component`

**Files:**
- Modify: `front4/src/app/features/centros/centros.service.ts`
- Modify: `front4/src/app/features/centros/pages/centros-page.component.ts`
- Modify: `front4/src/app/features/centros/pages/centros-page.component.html`

**Interfaces:**
- Consumes: `@Output() fotoFile` de `CentroFormComponent` (Tarea 6).
- Produces: `CentrosService.subirFoto(empresaId, centroId, file, onSuccess?, onError?): void`; `CentrosService.crear(dto, fotoFile?)` y `.actualizar(id, dto, fotoFile?)` ahora aceptan un segundo parámetro opcional.

- [ ] **Step 1: Agregar `subirFoto` y actualizar `crear`/`actualizar` en el service**

En `front4/src/app/features/centros/centros.service.ts`, reemplazar los métodos `crear` y `actualizar` (líneas 47-71) por:

```ts
crear(dto: CreateCentroDto, fotoFile?: File | null): void {
  const { cliente_id, ...body } = dto;
  if (!cliente_id) {
    this.setStatus({ type: 'error', text: 'Debes seleccionar una empresa.' });
    return;
  }
  this.http.post<CentroCosto>(this.api.url(`/empresas/${cliente_id}/centros`), body).subscribe({
    next: (centro) => {
      if (fotoFile) {
        this.subirFoto(cliente_id, centro._id, fotoFile,
          () => { this.setStatus({ type: 'ok', text: 'Centro creado correctamente' }); this.cargar(); },
          (msg) => { this.setStatus({ type: 'error', text: `Centro creado, pero no se pudo subir la foto: ${msg}` }); this.cargar(); },
        );
      } else {
        this.setStatus({ type: 'ok', text: 'Centro creado correctamente' });
        this.cargar();
      }
    },
    error: (err) => this.setError(err),
  });
}

actualizar(id: string, dto: UpdateCentroDto, fotoFile?: File | null): void {
  const empresaId = dto.cliente_id ?? this.seleccionado()?.cliente_id;
  if (!empresaId) { this.setError({ error: { message: 'No se pudo determinar la empresa del centro' } }); return; }
  const { cliente_id, ...body } = dto as CreateCentroDto;
  this.http.put<CentroCosto>(this.api.url(`/empresas/${empresaId}/centros/${id}`), body).subscribe({
    next: () => {
      if (fotoFile) {
        this.subirFoto(String(empresaId), id, fotoFile,
          () => { this.setStatus({ type: 'ok', text: 'Centro actualizado' }); this.seleccionado.set(null); this.cargar(); },
          (msg) => { this.setStatus({ type: 'error', text: `Centro actualizado, pero no se pudo subir la foto: ${msg}` }); this.cargar(); },
        );
      } else {
        this.setStatus({ type: 'ok', text: 'Centro actualizado' });
        this.seleccionado.set(null);
        this.cargar();
      }
    },
    error: (err) => this.setError(err),
  });
}

subirFoto(empresaId: string, centroId: string, file: File, onSuccess?: () => void, onError?: (msg: string) => void): void {
  const form = new FormData();
  form.append('archivo', file);
  this.http.post<CentroCosto>(this.api.url(`/empresas/${empresaId}/centros/${centroId}/foto`), form).subscribe({
    next: () => { if (onSuccess) onSuccess(); else this.cargar(); },
    error: (err) => {
      const raw = err?.error?.message ?? 'Error al subir la foto';
      const msg = Array.isArray(raw) ? raw.join(', ') : raw;
      if (onError) onError(msg);
      else this.setStatus({ type: 'error', text: msg });
    },
  });
}
```

- [ ] **Step 2: Wiring en `centros-page.component.ts`**

En `front4/src/app/features/centros/pages/centros-page.component.ts`:

Agregar el signal junto a los demás (después de la línea 122, `protected busqueda = signal('');`):

```ts
protected pendingFoto = signal<File | null>(null);
```

Modificar `abrirCrear`, `abrirEditar`, `cerrar`, `crear`, `actualizar` y `editarDesdeBuscar`:

```ts
protected abrirCrear(): void {
  this.service.seleccionado.set(null);
  this.service.clearStatus();
  this.pendingFoto.set(null);
  this.modal.set('crear');
}
```

```ts
protected abrirEditar(centro: CentroCosto): void {
  this.service.seleccionar(centro);
  this.pendingFoto.set(null);
  this.modal.set('editar');
}
```

```ts
protected cerrar(): void {
  this.modal.set(null);
  this.service.seleccionado.set(null);
  this.service.clearStatus();
  this.pendingFoto.set(null);
  this.centroParaActivo.set(null);
  this.activosService.clearStatus();
  this.centroParaScore.set(null);
  this.guardandoScore.set(false);
  this.scoreError.set(null);
}
```

```ts
protected crear(dto: CreateCentroDto): void {
  this.service.crear(dto, this.pendingFoto());
  this.pendingFoto.set(null);
}

protected actualizar(dto: CreateCentroDto): void {
  const id = this.service.seleccionado()?._id;
  if (id) this.service.actualizar(id, dto, this.pendingFoto());
  this.pendingFoto.set(null);
}
```

```ts
protected editarDesdeBuscar(centro: CentroCosto): void {
  this.service.seleccionar(centro);
  this.pendingFoto.set(null);
  this.modal.set('editar');
}
```

- [ ] **Step 3: Wiring en `centros-page.component.html`**

En `front4/src/app/features/centros/pages/centros-page.component.html`, agregar `(fotoFile)="pendingFoto.set($event)"` a los dos usos de `<app-centro-form>`:

```html
<app-centro-form
  submitLabel="Crear centro"
  [clientes]="clientesService.clientes()"
  (fotoFile)="pendingFoto.set($event)"
  (submitted)="crear($event)">
</app-centro-form>
```

```html
<app-centro-form
  [initial]="service.seleccionado()"
  [clientes]="clientesService.clientes()"
  submitLabel="Guardar cambios"
  (fotoFile)="pendingFoto.set($event)"
  (submitted)="actualizar($event)">
</app-centro-form>
```

- [ ] **Step 4: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 5: Verificación manual en navegador**

Con `npm run start:dev` (back4) y `npm start` (front4) corriendo: entrar como admin a `/centros`, crear o editar un centro, subir una foto desde el panel lateral, guardar, y confirmar que el preview se actualiza correctamente al reabrir el modal de edición.

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/features/centros/centros.service.ts front4/src/app/features/centros/pages/centros-page.component.ts front4/src/app/features/centros/pages/centros-page.component.html
git commit -m "feat(front4): subir foto de centro desde el admin"
```

---

### Task 8: Foto de empresa en "Mi ficha" (consumidor)

**Files:**
- Modify: `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts`
- Modify: `front4/src/app/features/dashboard/pages/mi-ficha-page.component.html`

**Interfaces:**
- Consumes: `empresa()` computed ya existente (devuelve `Cliente | null`, con `logo?.tipo_mime` — dato ya poblado por el backend, ver Tarea "Contexto" del spec), `ApiService.url(path)`.
- Produces: `fotoUrl` computed `() => string | null`.

- [ ] **Step 1: Agregar el computed e importar `ApiService`**

En `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts`, agregar el import (junto a los demás, después de la línea 15 `import { CentroCosto } from '../../../shared/models/centro.model';`):

```ts
import { ApiService } from '../../../core/services/api.service';
```

Agregar la inyección junto a las demás (después de la línea 27, `private readonly centrosService = inject(CentrosService);`):

```ts
private readonly api = inject(ApiService);
```

Agregar el computed junto a `empresa` (después de la línea 58, `protected empresa = computed(() => this.consumidorContext.empresaSeleccionada());`):

```ts
protected fotoUrl = computed(() => {
  const emp = this.empresa();
  if (!emp?._id || !emp?.logo?.tipo_mime) return null;
  return this.api.url(`/empresas/${emp._id}/logo`);
});
```

- [ ] **Step 2: Actualizar el recuadro "Información general" en el `.html`**

En `front4/src/app/features/dashboard/pages/mi-ficha-page.component.html`, reemplazar el bloque completo del "Recuadro 1" (líneas 17-62):

```html
    <!-- Recuadro 1: Información general de la empresa -->
    <div class="card" style="display:grid;grid-template-columns:1fr 200px;gap:1.25rem">
      <div>
        <h3 style="margin:0 0 1rem;font-size:.95rem;font-weight:700;color:#1f2937">Información general</h3>
        <dl style="margin:0;display:flex;flex-direction:column;gap:.55rem">
          <div style="display:flex;gap:.5rem">
            <dt style="font-size:.78rem;color:#6b7280;min-width:90px;flex-shrink:0">Razón social</dt>
            <dd style="margin:0;font-size:.82rem;color:#1f2937;font-weight:600">{{ empresa()!.razon_social }}</dd>
          </div>
          <div style="display:flex;gap:.5rem">
            <dt style="font-size:.78rem;color:#6b7280;min-width:90px;flex-shrink:0">RUT</dt>
            <dd style="margin:0;font-size:.82rem;color:#1f2937">{{ empresa()!.rut }}</dd>
          </div>
          <div style="display:flex;gap:.5rem">
            <dt style="font-size:.78rem;color:#6b7280;min-width:90px;flex-shrink:0">Email</dt>
            <dd style="margin:0;font-size:.82rem;color:#1f2937">
              <a [href]="'mailto:' + empresa()!.email_contacto" style="color:#0095d6;text-decoration:none">{{ empresa()!.email_contacto }}</a>
            </dd>
          </div>
          @if (empresa()!.telefono) {
            <div style="display:flex;gap:.5rem">
              <dt style="font-size:.78rem;color:#6b7280;min-width:90px;flex-shrink:0">Teléfono</dt>
              <dd style="margin:0;font-size:.82rem;color:#1f2937">{{ empresa()!.telefono }}</dd>
            </div>
          }
          @if (empresa()!.direccion?.ciudad) {
            <div style="display:flex;gap:.5rem">
              <dt style="font-size:.78rem;color:#6b7280;min-width:90px;flex-shrink:0">Ciudad</dt>
              <dd style="margin:0;font-size:.82rem;color:#1f2937">
                {{ empresa()!.direccion!.ciudad }}{{ empresa()!.direccion!.region ? ', ' + empresa()!.direccion!.region : '' }}
              </dd>
            </div>
          }
          @if (empresa()!.direccion?.calle) {
            <div style="display:flex;gap:.5rem">
              <dt style="font-size:.78rem;color:#6b7280;min-width:90px;flex-shrink:0">Dirección</dt>
              <dd style="margin:0;font-size:.82rem;color:#1f2937">{{ empresa()!.direccion!.calle }}</dd>
            </div>
          }
          <div style="display:flex;gap:.5rem">
            <dt style="font-size:.78rem;color:#6b7280;min-width:90px;flex-shrink:0">Estado</dt>
            <dd style="margin:0">
              <span style="font-size:.72rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;background:#dcfce7;color:#15803d">Activa</span>
            </dd>
          </div>
        </dl>
      </div>
      @if (fotoUrl(); as foto) {
        <img [src]="foto" alt="Foto de la empresa" style="width:100%;height:100%;min-height:180px;object-fit:cover;border-radius:12px;border:1px solid rgba(34,33,33,.08);display:block" />
      } @else {
        <div style="min-height:180px;border-radius:12px;border:1.5px dashed #d1d5db;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;color:#9ca3af">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style="font-size:.72rem;font-weight:600">Sin foto</span>
        </div>
      }
    </div>
```

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificación manual en navegador**

Como consumidor (o super_admin en modo consumidor), entrar a `/mi-ficha` con una empresa que tenga logo cargado → debe verse la foto a la derecha del recuadro. Con una empresa sin logo → debe verse el placeholder de cámara.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts front4/src/app/features/dashboard/pages/mi-ficha-page.component.html
git commit -m "feat(front4): mostrar foto de empresa en Mi ficha"
```

---

### Task 9: Miniatura de foto en el listado de "Mis centros"

**Files:**
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.ts`
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.html`

**Interfaces:**
- Produces: `fotoUrlCentro(centro: CentroCosto): string | null` — método usado también por la Tarea 10.

- [ ] **Step 1: Agregar `ApiService` y el método**

En `front4/src/app/features/centros/pages/mis-centros-page.component.ts`, agregar el import (junto a los demás, después de la línea 17, `import { Proyecto, EstadoProyecto, ESTADO_PROYECTO_LABEL } from '../../../shared/models/proyecto.model';`):

```ts
import { ApiService } from '../../../core/services/api.service';
```

Agregar la inyección (junto a las demás, después de la línea 45, `private readonly sanitizer = inject(DomSanitizer);`):

```ts
private readonly api = inject(ApiService);
```

Agregar el método (junto a `scoreDeCentro`, después de la línea 118):

```ts
protected fotoUrlCentro(centro: CentroCosto | null): string | null {
  if (!centro?._id || !centro?.foto?.tipo_mime) return null;
  return this.api.url(`/empresas/${asId(centro.cliente_id)}/centros/${asId(centro._id)}/foto`);
}
```

- [ ] **Step 2: Actualizar el header de cada card en el `.html`**

En `front4/src/app/features/centros/pages/mis-centros-page.component.html`, reemplazar el bloque "Cabecera: nombre + donut" (líneas 48-60):

```html
          <!-- Cabecera: nombre + donut -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem">
            <div style="flex:1;min-width:0;display:flex;align-items:center;gap:.6rem">
              @if (fotoUrlCentro(c); as foto) {
                <img [src]="foto" alt="Foto de {{ c.nombre }}" style="width:40px;height:40px;border-radius:9px;object-fit:cover;border:1px solid rgba(34,33,33,.1);flex-shrink:0" />
              } @else {
                <div style="width:40px;height:40px;border-radius:9px;border:1.5px dashed #d1d5db;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#9ca3af">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
              }
              <div style="flex:1;min-width:0">
                <h3 style="margin:0 0 .15rem;font-size:1rem;font-weight:700;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ c.nombre }}</h3>
                <span style="font-size:.78rem;color:#6b7280">Cód. {{ c.codigo }}</span>
                @if (c.ubicacion_ciudad) {
                  <p style="margin:.25rem 0 0;font-size:.8rem;color:#6b7280">
                    {{ c.ubicacion_ciudad }}{{ c.ubicacion_region ? ', ' + c.ubicacion_region : '' }}
                  </p>
                }
              </div>
            </div>
            <app-donut-arc [value]="sc.pct" [size]="66"></app-donut-arc>
          </div>
```

Nota: el `<app-donut-arc>` no cambia de posición — sigue siendo el segundo hijo del flex `justify-content:space-between`, a la derecha. Solo el bloque de texto de la izquierda pasa de un solo `<div>` a un `<div style="display:flex;align-items:center">` que envuelve la miniatura + el bloque nombre/código/ciudad.

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificación manual en navegador**

Entrar a `/mis-centros` como consumidor. Confirmar que la miniatura aparece a la izquierda del nombre en cada card, sin desplazar ni tapar el donut de score. Confirmar el placeholder de cámara en centros sin foto.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/centros/pages/mis-centros-page.component.ts front4/src/app/features/centros/pages/mis-centros-page.component.html
git commit -m "feat(front4): miniatura de foto de centro en el listado de Mis centros"
```

---

### Task 10: Foto grande en el detalle de centro

**Files:**
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.html`

**Interfaces:**
- Consumes: `fotoUrlCentro(centro)` de la Tarea 9 (mismo componente).

- [ ] **Step 1: Actualizar el "Recuadro 1: Información general" de la vista detalle**

En `front4/src/app/features/centros/pages/mis-centros-page.component.html`, la Tarea 9 ya modificó este archivo (desplazó los números de línea) — ubicar el bloque por su comentario `<!-- Recuadro 1: Información general -->` (dentro de la sección `<!-- ══ VISTA DETALLE ══... -->`, es el primer `<div class="card" style="min-height:320px">` de esa sección) y reemplazarlo completo por:

```html
    <!-- Recuadro 1: Información general -->
    <div class="card" style="min-height:320px;display:grid;grid-template-columns:1fr 220px;gap:1.25rem">
      <div>
        <h3 style="margin:0 0 1rem;font-size:.95rem;font-weight:700;color:#1f2937">Información general</h3>
        <dl style="margin:0;display:flex;flex-direction:column;gap:.55rem">
          <div style="display:flex;gap:.5rem">
            <dt style="font-size:.78rem;color:#6b7280;min-width:80px;flex-shrink:0">Nombre</dt>
            <dd style="margin:0;font-size:.82rem;color:#1f2937;font-weight:500">{{ centroActivo.nombre }}</dd>
          </div>
          <div style="display:flex;gap:.5rem">
            <dt style="font-size:.78rem;color:#6b7280;min-width:80px;flex-shrink:0">Código</dt>
            <dd style="margin:0;font-size:.82rem;color:#0095d6;font-weight:600">{{ centroActivo.codigo }}</dd>
          </div>
          @if (centroActivo.descripcion) {
            <div style="display:flex;gap:.5rem">
              <dt style="font-size:.78rem;color:#6b7280;min-width:80px;flex-shrink:0">Descripción</dt>
              <dd style="margin:0;font-size:.82rem;color:#1f2937">{{ centroActivo.descripcion }}</dd>
            </div>
          }
          @if (centroActivo.ubicacion_direccion) {
            <div style="display:flex;gap:.5rem">
              <dt style="font-size:.78rem;color:#6b7280;min-width:80px;flex-shrink:0">Dirección</dt>
              <dd style="margin:0;font-size:.82rem;color:#1f2937">{{ centroActivo.ubicacion_direccion }}</dd>
            </div>
          }
          @if (centroActivo.ubicacion_ciudad) {
            <div style="display:flex;gap:.5rem">
              <dt style="font-size:.78rem;color:#6b7280;min-width:80px;flex-shrink:0">Ciudad</dt>
              <dd style="margin:0;font-size:.82rem;color:#1f2937">
                {{ centroActivo.ubicacion_ciudad }}{{ centroActivo.ubicacion_region ? ', ' + centroActivo.ubicacion_region : '' }}
              </dd>
            </div>
          }
          @if (centroActivo.ubicacion_pais) {
            <div style="display:flex;gap:.5rem">
              <dt style="font-size:.78rem;color:#6b7280;min-width:80px;flex-shrink:0">País</dt>
              <dd style="margin:0;font-size:.82rem;color:#1f2937">{{ centroActivo.ubicacion_pais }}</dd>
            </div>
          }
        </dl>
      </div>
      @if (fotoUrlCentro(centroActivo); as foto) {
        <img [src]="foto" alt="Foto de {{ centroActivo.nombre }}" style="width:100%;height:100%;min-height:220px;object-fit:cover;border-radius:12px;border:1px solid rgba(34,33,33,.08);display:block" />
      } @else {
        <div style="min-height:220px;border-radius:12px;border:1.5px dashed #d1d5db;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;color:#9ca3af">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style="font-size:.72rem;font-weight:600">Sin foto</span>
        </div>
      }
    </div>
```

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos.

- [ ] **Step 3: Verificación manual en navegador**

Entrar a `/mis-centros`, hacer clic en "Ver detalle" de un centro con foto cargada → debe verse la foto grande a la derecha del recuadro "Información general". En un centro sin foto → placeholder de cámara.

- [ ] **Step 4: Build completo de verificación final**

Run: `cd back4 && npm run build && cd ../front4 && npm run build`
Expected: ambos builds terminan sin errores — confirma que todo el feature (backend + frontend) compila de punta a punta.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/centros/pages/mis-centros-page.component.html
git commit -m "feat(front4): foto de centro en el detalle de Mis centros"
```
