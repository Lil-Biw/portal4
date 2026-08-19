# Imagen de portada para empresas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un campo de imagen de portada (`imagen`) al formulario de empresa, distinto del `logo` existente, extrayendo un componente compartido de upload de imagen que también migra el patrón ya usado por `foto` de centro.

**Architecture:** Backend replica exactamente el patrón `logo` de `Cliente` (Buffer en Mongo, endpoints dedicados `POST`/`GET /empresas/:id/imagen`) para un nuevo campo `imagen`. Frontend extrae un componente standalone `ImageUploadComponent` (panel con preview, placeholder y botón "Cambiar X") a partir del markup que hoy vive solo en `centro-form`, lo usa en tres sitios (`logo` y `imagen` de empresa, `foto` de centro), y corrige un mislabeling en "Mi ficha" donde el recuadro grande mostraba el logo etiquetado como "foto".

**Tech Stack:** NestJS 10 + Mongoose 8 (back4), Angular 21 standalone + signals (front4), Vitest para specs de componentes compartidos.

## Global Constraints

- Backend: el campo `imagen` sigue el mismo patrón que `logo` — `Buffer` en Mongo, **no** pasa por S3 (excepción documentada en `back4/CLAUDE.md`).
- Backend: subir requiere rol `super_admin` o `admin_smartclarity`; servir es `@Public()`. Límite de tamaño: `OPCIONES_SUBIDA` (20MB), sin cambios.
- Backend: todo query de lectura de `Cliente` debe excluir el binario (`-logo.contenido -imagen.contenido`) — nunca devolver el buffer en el CRUD normal.
- Frontend: sin `any`; signals para estado reactivo; control flow `@if`/`@for` (nunca `*ngIf`/`*ngFor`); todos los componentes standalone; `strictTemplates: true` está activo — los miembros usados desde un template deben ser `protected`/`public`, nunca `private`.
- Frontend: no se agrega thumbnail de `imagen`/`logo` en el listado admin de empresas (`clientes-list`) — fuera de alcance.
- No hay migración de datos existentes — `imagen` es opcional, igual que `logo` cuando se introdujo.

---

### Task 1: Backend — campo `imagen` en Cliente + endpoints de subida/servido

**Files:**
- Modify: `back4/src/clientes/clientes.schema.ts`
- Modify: `back4/src/clientes/clientes.service.ts`
- Modify: `back4/src/clientes/clientes.controller.ts`

**Interfaces:**
- Consumes: nada nuevo — reutiliza `OPCIONES_SUBIDA` (`common/constants/upload.constants.ts`), `sendFile` (`common/helpers/send-file.helper.ts`), decoradores `@Roles`/`@Public` ya importados en el controller.
- Produces: `ClientesService.subirImagen(id, archivo)`, `ClientesService.servirImagen(id): Promise<{buffer, tipo_mime, nombre}>`, endpoints `POST /empresas/:id/imagen` y `GET /empresas/:id/imagen`.

- [ ] **Step 1: Agregar el campo `imagen` al schema**

En `back4/src/clientes/clientes.schema.ts`, insertar después del campo `logo` (línea 34, antes de `score_smartclarity`):

```ts
  @Prop({
    type: {
      contenido: Buffer,
      tipo_mime: String,
      nombre: String,
    },
  })
  imagen?: { contenido: Buffer; tipo_mime: string; nombre: string };
```

- [ ] **Step 2: Excluir `imagen.contenido` de las queries de lectura**

En `back4/src/clientes/clientes.service.ts`, reemplazar cada ocurrencia de `.select('-logo.contenido')` por `.select('-logo.contenido -imagen.contenido')`. Ocurre en 5 métodos: `findAll` (línea 49), `findOne` (línea 56), `update` (línea 64), `updateScoreSmartclarity` (línea 81), `updateConfigGrafico` (línea 90).

- [ ] **Step 3: Agregar `subirImagen`/`servirImagen` al service**

En `back4/src/clientes/clientes.service.ts`, inmediatamente después del método `servirLogo` (termina en la línea 124, antes de `agregarDocumento`), agregar:

```ts
  async subirImagen(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const cliente = await this.clienteModel.findById(id).lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return this.clienteModel
      .findByIdAndUpdate(
        id,
        { imagen: { contenido: archivo.buffer, tipo_mime: archivo.mimetype, nombre: archivo.originalname } },
        { new: true, runValidators: false },
      )
      .select('-logo.contenido -imagen.contenido')
      .lean();
  }

  async servirImagen(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
    const cliente = await this.clienteModel.findById(id).select('imagen').lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    if (!cliente.imagen?.contenido) throw new NotFoundException('Este cliente no tiene imagen');
    const raw = cliente.imagen.contenido as unknown;
    let buffer: Buffer;
    if (Buffer.isBuffer(raw)) {
      buffer = raw;
    } else if (raw && typeof raw === 'object' && 'buffer' in (raw as object)) {
      const buf = (raw as { buffer: Buffer | ArrayBuffer }).buffer;
      buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    } else {
      buffer = Buffer.from(raw as ArrayBuffer);
    }
    return { buffer, tipo_mime: cliente.imagen.tipo_mime, nombre: cliente.imagen.nombre };
  }
```

- [ ] **Step 4: Agregar los endpoints al controller**

En `back4/src/clientes/clientes.controller.ts`, inmediatamente después de `servirLogo` (termina en la línea 119, antes de `subirDocumento`), agregar:

```ts
  @Post(':id/imagen')
  @Roles('super_admin', 'admin_smartclarity')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirImagen(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.clientesService.subirImagen(id, archivo);
  }

  @Get(':id/imagen')
  @Public()
  async servirImagen(@Param('id') id: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre } =
      await this.clientesService.servirImagen(id);
    sendFile(res, buffer, tipo_mime, nombre, true);
  }
```

- [ ] **Step 5: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: termina sin errores (`nest build` usa el mismo compilador TS estricto del proyecto).

La verificación funcional en vivo (curl/subida real) se hace en la Tarea 8, junto con el resto del flujo end-to-end — no hay framework de tests unitarios instalado en `back4` (confirmado: ningún módulo de negocio tiene `.spec.ts`).

- [ ] **Step 6: Commit**

```bash
cd back4
git add src/clientes/clientes.schema.ts src/clientes/clientes.service.ts src/clientes/clientes.controller.ts
git commit -m "feat(back4): agregar campo imagen a Cliente con endpoints de subida/servido"
```

---

### Task 2: Frontend — componente compartido `ImageUploadComponent`

**Files:**
- Create: `front4/src/app/shared/components/image-upload/image-upload.component.ts`
- Create: `front4/src/app/shared/components/image-upload/image-upload.component.spec.ts`

**Interfaces:**
- Consumes: nada (componente puro, sin dependencias de otros features).
- Produces: selector `app-image-upload`. Inputs: `titulo: string`, `aspectRatio: string`, `objectFit: 'cover' | 'contain'`, `hint: string`, `initialUrl: string | null`. Output: `archivoSeleccionado: EventEmitter<File | null>`.

- [ ] **Step 1: Escribir el spec (test que debe fallar)**

Crear `front4/src/app/shared/components/image-upload/image-upload.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ImageUploadComponent } from './image-upload.component';

describe('ImageUploadComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ImageUploadComponent] }).compileComponents();
  });

  it('renderiza el título y el hint', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.componentRef.setInput('titulo', 'Logo');
    fixture.componentRef.setInput('hint', 'Opcional. JPG, PNG o SVG.');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Logo');
    expect(el.textContent).toContain('Opcional. JPG, PNG o SVG.');
  });

  it('muestra el placeholder cuando no hay initialUrl ni archivo seleccionado', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('muestra la imagen cuando initialUrl viene seteado', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.componentRef.setInput('initialUrl', 'http://localhost/empresas/1/logo');
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain('/empresas/1/logo');
  });

  it('emite el archivo seleccionado al elegir uno en el input', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.detectChanges();
    const file = new File(['contenido'], 'logo.png', { type: 'image/png' });
    let emitido: File | null = null;
    fixture.componentInstance.archivoSeleccionado.subscribe((f: File | null) => { emitido = f; });
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(emitido).toBe(file);
  });

  it('vuelve a mostrar el placeholder si initialUrl cambia a null', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.componentRef.setInput('initialUrl', 'http://localhost/empresas/1/logo');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).not.toBeNull();

    fixture.componentRef.setInput('initialUrl', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `cd front4 && npm test -- --include=src/app/shared/components/image-upload/**/*.spec.ts --watch=false`
Expected: FAIL — `image-upload.component.ts` no existe todavía.

- [ ] **Step 3: Implementar el componente**

Crear `front4/src/app/shared/components/image-upload/image-upload.component.ts`:

```ts
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';

@Component({
  selector: 'app-image-upload',
  standalone: true,
  template: `
    <div class="image-upload">
      <span class="image-upload-label">{{ titulo }}</span>
      <div class="image-upload-frame" [style.aspect-ratio]="aspectRatio">
        @if (preview) {
          <img [src]="preview" [alt]="titulo" [style.object-fit]="objectFit" />
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        }
      </div>
      <label class="image-upload-btn">
        Cambiar {{ titulo.toLowerCase() }}
        <input type="file" accept="image/*" (change)="onFileChange($event)" />
      </label>
      @if (hint) {
        <p class="image-upload-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [`
    .image-upload {
      border: 1px solid rgba(34,33,33,.12);
      border-radius: 10px;
      padding: .85rem;
      display: flex;
      flex-direction: column;
      gap: .65rem;
      background: #f9fafb;
    }
    .image-upload-label {
      font-size: .75rem;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: .03em;
    }
    .image-upload-frame {
      width: 100%;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image-upload-frame img {
      width: 100%;
      height: 100%;
    }
    .image-upload-btn {
      text-align: center;
      font-size: .78rem;
      font-weight: 600;
      color: #0095d6;
      border: 1px solid rgba(0,149,214,.35);
      background: rgba(0,149,214,.06);
      border-radius: 8px;
      padding: .5rem;
      cursor: pointer;
    }
    .image-upload-btn input[type="file"] { display: none; }
    .image-upload-hint {
      margin: 0;
      font-size: .7rem;
      color: #9ca3af;
      text-align: center;
      line-height: 1.4;
    }
  `],
})
export class ImageUploadComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() titulo = 'Imagen';
  @Input() aspectRatio = '4/3';
  @Input() objectFit: 'cover' | 'contain' = 'cover';
  @Input() hint = '';
  @Input() initialUrl: string | null = null;
  @Output() archivoSeleccionado = new EventEmitter<File | null>();

  preview: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialUrl']) this.preview = this.initialUrl;
  }

  onFileChange(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.archivoSeleccionado.emit(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { this.preview = e.target?.result as string; this.cdr.markForCheck(); };
      reader.readAsDataURL(file);
    } else {
      this.preview = this.initialUrl;
    }
  }
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `cd front4 && npm test -- --include=src/app/shared/components/image-upload/**/*.spec.ts --watch=false`
Expected: PASS — los 5 tests en verde.

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/shared/components/image-upload/
git commit -m "feat(front4): componente compartido ImageUploadComponent"
```

---

### Task 3: Frontend — migrar `centro-form` al componente compartido

**Files:**
- Modify: `front4/src/app/features/centros/components/centro-form/centro-form.component.ts`
- Modify: `front4/src/app/features/centros/components/centro-form/centro-form.component.html`

**Interfaces:**
- Consumes: `ImageUploadComponent` (Task 2) — `[initialUrl]`, `(archivoSeleccionado)`.
- Produces: sin cambios en el contrato externo de `CentroFormComponent` (`@Output() fotoFile` se mantiene igual).

- [ ] **Step 1: Actualizar `centro-form.component.ts`**

En `front4/src/app/features/centros/components/centro-form/centro-form.component.ts`:

1. En el import de `@angular/core` (línea 1), quitar `ChangeDetectorRef` de la lista (ya no se usa).
2. Agregar el import del componente compartido:
   ```ts
   import { ImageUploadComponent } from '../../../../shared/components/image-upload/image-upload.component';
   ```
3. En el decorador `@Component`, agregar `ImageUploadComponent` al array `imports` (junto a `FormsModule, NgFor`).
4. Quitar la línea `private readonly cdr = inject(ChangeDetectorRef);` (línea 29).
5. Quitar el campo `fotoPreview: string | null = null;` (línea 42) — dejar solo `private _fotoFile: File | null = null;` pero cambiado a `protected` (ver punto 7).
6. Cambiar `private resolveFotoUrl` (línea 99) a `protected resolveFotoUrl` — ahora se llama directamente desde el template.
7. Cambiar `private _fotoFile` a `protected _fotoFile` — ahora se asigna directamente desde el template (con `strictTemplates` activo, un miembro `private` no es accesible desde el template del propio componente).
8. Eliminar el método `onFotoSelected(ev: Event): void { ... }` completo (líneas 104-114) — ya no se necesita, `ImageUploadComponent` gestiona su propio preview.
9. En `ngOnChanges` (línea 116), reemplazar:
   ```ts
   this.fotoPreview = this.resolveFotoUrl(this.initial);
   this._fotoFile = null;
   ```
   por:
   ```ts
   this._fotoFile = null;
   ```

- [ ] **Step 2: Actualizar `centro-form.component.html`**

En `front4/src/app/features/centros/components/centro-form/centro-form.component.html`, reemplazar el bloque completo del panel lateral (líneas 100-115, desde `<!-- Panel lateral: foto del centro -->` hasta el `</div>` que lo cierra) por:

```html
  <!-- Panel lateral: foto del centro -->
  <app-image-upload
    titulo="Foto del centro"
    aspectRatio="4/3"
    hint="JPG o PNG · se muestra en el listado y en el detalle del centro"
    [initialUrl]="resolveFotoUrl(initial)"
    (archivoSeleccionado)="_fotoFile = $event">
  </app-image-upload>
```

- [ ] **Step 3: Verificar que compila y no rompe nada**

Run: `cd front4 && npm run build`
Expected: termina sin errores (esto ejercita el chequeo estricto de templates de Angular, incluyendo el acceso a `_fotoFile`/`resolveFotoUrl` desde el template).

- [ ] **Step 4: Commit**

```bash
cd front4
git add src/app/features/centros/components/centro-form/
git commit -m "refactor(front4): migrar centro-form al componente compartido image-upload"
```

---

### Task 4: Frontend — modelo `Cliente.imagen` + formulario de empresa con dos paneles

**Files:**
- Modify: `front4/src/app/shared/models/cliente.model.ts`
- Modify: `front4/src/app/features/clientes/components/cliente-form/cliente-form.component.ts`
- Modify: `front4/src/app/features/clientes/components/cliente-form/cliente-form.component.html`

**Interfaces:**
- Consumes: `ImageUploadComponent` (Task 2). Backend `GET /empresas/:id/imagen` (Task 1) para la resolución de preview en modo edición (verificado en vivo en la Tarea 8).
- Produces: `Cliente.imagen?: { tipo_mime: string; nombre: string }` en el modelo. `ClienteFormComponent` gana `@Output() imagenFile: EventEmitter<File | null>`.

- [ ] **Step 1: Agregar `imagen` al modelo**

En `front4/src/app/shared/models/cliente.model.ts`, en la interfaz `Cliente`, agregar después de `logo`:

```ts
  logo?: { tipo_mime: string; nombre: string };
  imagen?: { tipo_mime: string; nombre: string };
```

- [ ] **Step 2: Reescribir `cliente-form.component.ts`**

Reemplazar el contenido completo de `front4/src/app/features/clientes/components/cliente-form/cliente-form.component.ts` por:

```ts
import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cliente, CreateClienteDto } from '../../../../shared/models/cliente.model';
import { ApiService } from '../../../../core/services/api.service';
import { ImageUploadComponent } from '../../../../shared/components/image-upload/image-upload.component';

@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [FormsModule, ImageUploadComponent],
  templateUrl: './cliente-form.component.html',
})
export class ClienteFormComponent implements OnChanges {
  private readonly api = inject(ApiService);

  @Input() initial: Cliente | null = null;
  @Input() submitLabel = 'Guardar';
  @Input() saving = false;
  @Output() submitted = new EventEmitter<CreateClienteDto>();
  @Output() logoFile = new EventEmitter<File | null>();
  @Output() imagenFile = new EventEmitter<File | null>();

  form: CreateClienteDto = this.empty();
  protected _logoFile: File | null = null;
  protected _imagenFile: File | null = null;

  // El backend no devuelve el binario de logo/imagen en el cliente (solo tipo_mime/nombre,
  // ver clientes.service.ts findAll/findOne con .select('-logo.contenido -imagen.contenido'))
  // — hay que pedirlos a los endpoints dedicados GET /empresas/:id/logo|imagen.
  protected resolveLogoUrl(cliente: Cliente | null): string | null {
    if (!cliente?._id || !cliente?.logo?.tipo_mime) return null;
    return this.api.url(`/empresas/${cliente._id}/logo`);
  }

  protected resolveImagenUrl(cliente: Cliente | null): string | null {
    if (!cliente?._id || !cliente?.imagen?.tipo_mime) return null;
    return this.api.url(`/empresas/${cliente._id}/imagen`);
  }

  ngOnChanges(): void {
    this.form = this.initial
      ? {
          razon_social: this.initial.razon_social,
          rut: this.initial.rut,
          email_contacto: this.initial.email_contacto,
          telefono: this.initial.telefono ?? '',
          direccion: {
            calle:  this.initial.direccion?.calle  ?? '',
            ciudad: this.initial.direccion?.ciudad ?? '',
            region: this.initial.direccion?.region ?? '',
            pais:   this.initial.direccion?.pais   ?? 'Chile',
          },
        }
      : this.empty();
    this._logoFile = null;
    this._imagenFile = null;
  }

  submit(): void {
    this.logoFile.emit(this._logoFile);
    this.imagenFile.emit(this._imagenFile);
    this.submitted.emit(this.form);
  }

  private empty(): CreateClienteDto {
    return {
      razon_social: '',
      rut: '',
      email_contacto: '',
      telefono: '',
      direccion: { calle: '', ciudad: '', region: '', pais: 'Chile' },
    };
  }
}
```

- [ ] **Step 3: Reescribir `cliente-form.component.html`**

Reemplazar el contenido completo de `front4/src/app/features/clientes/components/cliente-form/cliente-form.component.html` por:

```html
<form (ngSubmit)="submit()" style="display:grid;grid-template-columns:1fr 230px;gap:1.25rem;align-items:start">
  <div class="form-grid">
    <label class="field">
      <span>Razón social *</span>
      <input [(ngModel)]="form.razon_social" name="razon_social" required />
    </label>
    <label class="field">
      <span>RUT *</span>
      <input [(ngModel)]="form.rut" name="rut" required />
    </label>
    <label class="field">
      <span>Email contacto *</span>
      <input [(ngModel)]="form.email_contacto" name="email_contacto" type="email" required />
    </label>
    <label class="field">
      <span>Teléfono</span>
      <input [(ngModel)]="form.telefono" name="telefono" />
    </label>
    <label class="field">
      <span>Calle</span>
      <input [(ngModel)]="form.direccion!.calle" name="calle" />
    </label>
    <label class="field">
      <span>Ciudad</span>
      <input [(ngModel)]="form.direccion!.ciudad" name="ciudad" />
    </label>
    <label class="field">
      <span>Región</span>
      <input [(ngModel)]="form.direccion!.region" name="region" />
    </label>
    <label class="field">
      <span>País</span>
      <input [(ngModel)]="form.direccion!.pais" name="pais" />
    </label>

    <div class="form-footer" style="grid-column:1/-1">
      <button type="submit" class="btn-primary" [disabled]="saving"
        style="display:inline-flex;align-items:center;gap:.5rem;min-width:130px;justify-content:center">
        @if (saving) {
          <span style="
            width:14px;height:14px;flex-shrink:0;
            border:2px solid rgba(255,255,255,.35);
            border-top-color:#fff;
            border-radius:50%;
            animation:btn-spin .65s linear infinite;
            display:inline-block">
          </span>
          Guardando...
        } @else {
          {{ submitLabel }}
        }
      </button>
    </div>
  </div>

  <!-- Panel lateral: logo + imagen de portada -->
  <div style="display:flex;flex-direction:column;gap:1rem">
    <app-image-upload
      titulo="Logo"
      aspectRatio="1/1"
      objectFit="contain"
      hint="Opcional. JPG, PNG o SVG."
      [initialUrl]="resolveLogoUrl(initial)"
      (archivoSeleccionado)="_logoFile = $event">
    </app-image-upload>

    <app-image-upload
      titulo="Imagen de portada"
      aspectRatio="4/3"
      hint="JPG o PNG · se muestra en Mi ficha"
      [initialUrl]="resolveImagenUrl(initial)"
      (archivoSeleccionado)="_imagenFile = $event">
    </app-image-upload>
  </div>
</form>
```

- [ ] **Step 4: Verificar que compila**

Run: `cd front4 && npm run build`
Expected: termina sin errores.

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/shared/models/cliente.model.ts src/app/features/clientes/components/cliente-form/
git commit -m "feat(front4): campo imagen de portada en el formulario de empresa"
```

---

### Task 5: Frontend — `ClientesService`: subida de imagen y orquestación logo+imagen

**Files:**
- Modify: `front4/src/app/features/clientes/clientes.service.ts`

**Interfaces:**
- Consumes: `POST /empresas/:id/imagen` (Task 1). `Cliente.imagen` (Task 4, solo por tipado de retorno del HTTP client).
- Produces: `crear(dto, logoFile?, imagenFile?)`, `actualizar(id, dto, logoFile?, imagenFile?)`, `subirImagen(id, file, onSuccess?, onError?)`.

- [ ] **Step 1: Reemplazar `crear`, `actualizar` y `subirLogo`, agregar `subirImagen`**

En `front4/src/app/features/clientes/clientes.service.ts`, reemplazar los métodos `crear` (líneas 34-51), `actualizar` (líneas 53-73) y `subirLogo` (líneas 75-87) por:

```ts
  crear(dto: CreateClienteDto, logoFile?: File | null, imagenFile?: File | null): void {
    this.saving.set(true);
    this.http.post<Cliente>(this.api.url('/empresas'), dto).subscribe({
      next: (cliente) => {
        this.saving.set(false);
        this.subirImagenesPendientes(cliente._id, logoFile, imagenFile,
          () => { this.setStatus({ type: 'ok', text: 'Empresa creada correctamente' }); this.cargar(); },
          (msg) => { this.setStatus({ type: 'error', text: `Empresa creada, pero no se pudo subir: ${msg}` }); this.cargar(); },
        );
      },
      error: (err) => { this.setError(err); this.saving.set(false); },
    });
  }

  actualizar(id: string, dto: UpdateClienteDto, logoFile?: File | null, imagenFile?: File | null): void {
    this.saving.set(true);
    this.http.put<Cliente>(this.api.url(`/empresas/${id}`), dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.subirImagenesPendientes(id, logoFile, imagenFile,
          () => { this.setStatus({ type: 'ok', text: 'Empresa actualizada' }); this.seleccionado.set(null); this.cargar(); },
          (msg) => { this.setStatus({ type: 'error', text: `Empresa actualizada, pero no se pudo subir: ${msg}` }); this.cargar(); },
        );
      },
      error: (err) => { this.setError(err); this.saving.set(false); },
    });
  }

  // Sube logo e imagen secuencialmente (si vienen) y acumula los mensajes de error
  // de cada subida fallida en uno solo — una subida fallida no revierte la entidad
  // ya creada/actualizada, solo se reporta como advertencia.
  private subirImagenesPendientes(
    id: string,
    logoFile: File | null | undefined,
    imagenFile: File | null | undefined,
    onSuccess: () => void,
    onError: (msg: string) => void,
  ): void {
    if (!logoFile && !imagenFile) { onSuccess(); return; }
    const errores: string[] = [];
    const subirLogoSiCorresponde = (next: () => void) => {
      if (!logoFile) { next(); return; }
      this.subirLogo(id, logoFile, next, (msg) => { errores.push(`logo (${msg})`); next(); });
    };
    const subirImagenSiCorresponde = (next: () => void) => {
      if (!imagenFile) { next(); return; }
      this.subirImagen(id, imagenFile, next, (msg) => { errores.push(`imagen (${msg})`); next(); });
    };
    subirLogoSiCorresponde(() => {
      subirImagenSiCorresponde(() => {
        if (errores.length > 0) onError(errores.join(', '));
        else onSuccess();
      });
    });
  }

  subirLogo(id: string, file: File, onSuccess?: () => void, onError?: (msg: string) => void): void {
    const form = new FormData();
    form.append('archivo', file);
    this.http.post<Cliente>(this.api.url(`/empresas/${id}/logo`), form).subscribe({
      next: () => { if (onSuccess) onSuccess(); else this.cargar(); },
      error: (err) => {
        const raw = err?.error?.message ?? 'Error al subir el logo';
        const msg = Array.isArray(raw) ? raw.join(', ') : raw;
        if (onError) onError(msg);
        else this.setStatus({ type: 'error', text: msg });
      },
    });
  }

  subirImagen(id: string, file: File, onSuccess?: () => void, onError?: (msg: string) => void): void {
    const form = new FormData();
    form.append('archivo', file);
    this.http.post<Cliente>(this.api.url(`/empresas/${id}/imagen`), form).subscribe({
      next: () => { if (onSuccess) onSuccess(); else this.cargar(); },
      error: (err) => {
        const raw = err?.error?.message ?? 'Error al subir la imagen';
        const msg = Array.isArray(raw) ? raw.join(', ') : raw;
        if (onError) onError(msg);
        else this.setStatus({ type: 'error', text: msg });
      },
    });
  }
```

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npm run build`
Expected: termina sin errores. (`ClientesPageComponent` todavía llama `crear`/`actualizar` con la firma vieja de 2 argumentos — sigue siendo válido porque `imagenFile` es opcional; se actualiza en la Tarea 6.)

- [ ] **Step 3: Commit**

```bash
cd front4
git add src/app/features/clientes/clientes.service.ts
git commit -m "feat(front4): ClientesService sube logo e imagen de portada"
```

---

### Task 6: Frontend — `ClientesPageComponent`: wiring de `pendingImagen`

**Files:**
- Modify: `front4/src/app/features/clientes/pages/clientes-page.component.ts`
- Modify: `front4/src/app/features/clientes/pages/clientes-page.component.html`

**Interfaces:**
- Consumes: `ClienteFormComponent` output `(imagenFile)` (Task 4). `ClientesService.crear/actualizar` con el tercer parámetro `imagenFile` (Task 5).
- Produces: nada consumido por otras tareas (estado interno de la página).

- [ ] **Step 1: Agregar la señal y su wiring en `clientes-page.component.ts`**

En `front4/src/app/features/clientes/pages/clientes-page.component.ts`:

1. Después de la línea `protected pendingLogo = signal<File | null>(null);` (línea 170), agregar:
   ```ts
   protected pendingImagen = signal<File | null>(null);
   ```
2. En `abrirCrear()` (líneas 215-220), después de `this.pendingLogo.set(null);`, agregar:
   ```ts
   this.pendingImagen.set(null);
   ```
3. En `abrirEditar()` (líneas 228-232), después de `this.pendingLogo.set(null);`, agregar:
   ```ts
   this.pendingImagen.set(null);
   ```
4. En `cerrar()` (líneas 234-242), después de `this.pendingLogo.set(null);`, agregar:
   ```ts
   this.pendingImagen.set(null);
   ```
5. En `editarDesdeBuscar()` (líneas 299-303), después de `this.pendingLogo.set(null);`, agregar:
   ```ts
   this.pendingImagen.set(null);
   ```
6. Reemplazar `crear()` (líneas 284-287):
   ```ts
   protected crear(dto: CreateClienteDto): void {
     this.service.crear(dto, this.pendingLogo(), this.pendingImagen());
     this.pendingLogo.set(null);
     this.pendingImagen.set(null);
   }
   ```
7. Reemplazar `actualizar()` (líneas 289-293):
   ```ts
   protected actualizar(dto: CreateClienteDto): void {
     const id = this.service.seleccionado()?._id;
     if (id) this.service.actualizar(id, dto, this.pendingLogo(), this.pendingImagen());
     this.pendingLogo.set(null);
     this.pendingImagen.set(null);
   }
   ```

- [ ] **Step 2: Agregar el binding en `clientes-page.component.html`**

En `front4/src/app/features/clientes/pages/clientes-page.component.html`, en los dos bloques `<app-cliente-form>` (líneas 43-48 y 57-63), agregar `(imagenFile)="pendingImagen.set($event)"` junto al `(logoFile)` existente en cada uno:

```html
      <app-cliente-form
        submitLabel="Crear empresa"
        [saving]="service.saving()"
        (logoFile)="pendingLogo.set($event)"
        (imagenFile)="pendingImagen.set($event)"
        (submitted)="crear($event)">
      </app-cliente-form>
```

```html
      <app-cliente-form
        [initial]="service.seleccionado()"
        submitLabel="Guardar cambios"
        [saving]="service.saving()"
        (logoFile)="pendingLogo.set($event)"
        (imagenFile)="pendingImagen.set($event)"
        (submitted)="actualizar($event)">
      </app-cliente-form>
```

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npm run build`
Expected: termina sin errores.

- [ ] **Step 4: Commit**

```bash
cd front4
git add src/app/features/clientes/pages/clientes-page.component.ts src/app/features/clientes/pages/clientes-page.component.html
git commit -m "feat(front4): wiring de imagen de portada en la página de empresas"
```

---

### Task 7: Frontend — "Mi ficha": imagen en el recuadro grande, logo como insignia

**Files:**
- Modify: `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts`
- Modify: `front4/src/app/features/dashboard/pages/mi-ficha-page.component.html`

**Interfaces:**
- Consumes: `Cliente.imagen`/`Cliente.logo` (Task 4). `GET /empresas/:id/imagen` y `GET /empresas/:id/logo` (Task 1, para la Tarea 8).
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Reemplazar el computed `fotoUrl` por `imagenUrl` + `logoUrl`**

En `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts`, reemplazar (líneas 62-66):

```ts
  protected fotoUrl = computed(() => {
    const emp = this.empresa();
    if (!emp?._id || !emp?.logo?.tipo_mime) return null;
    return this.api.url(`/empresas/${emp._id}/logo`);
  });
```

por:

```ts
  protected imagenUrl = computed(() => {
    const emp = this.empresa();
    if (!emp?._id || !emp?.imagen?.tipo_mime) return null;
    return this.api.url(`/empresas/${emp._id}/imagen`);
  });

  protected logoUrl = computed(() => {
    const emp = this.empresa();
    if (!emp?._id || !emp?.logo?.tipo_mime) return null;
    return this.api.url(`/empresas/${emp._id}/logo`);
  });
```

- [ ] **Step 2: Actualizar el header con la insignia de logo**

En `front4/src/app/features/dashboard/pages/mi-ficha-page.component.html`, reemplazar el bloque del header (líneas 1-7):

```html
<div style="margin-bottom:1.25rem">
  <h2 style="margin:0 0 .25rem;font-size:1.55rem;font-weight:700;color:#1f2937">Mi ficha</h2>
  <p style="margin:0;font-size:.85rem;color:#6b7280">
    {{ empresa()?.razon_social ?? 'Selecciona una empresa' }}
  </p>
</div>
```

por:

```html
<div style="margin-bottom:1.25rem;display:flex;align-items:center;gap:.75rem">
  @if (logoUrl(); as logo) {
    <img [src]="logo" alt="Logo de la empresa" style="width:40px;height:40px;object-fit:contain;border-radius:8px;border:1px solid rgba(34,33,33,.08);background:#fff;flex-shrink:0" />
  }
  <div>
    <h2 style="margin:0 0 .25rem;font-size:1.55rem;font-weight:700;color:#1f2937">Mi ficha</h2>
    <p style="margin:0;font-size:.85rem;color:#6b7280">
      {{ empresa()?.razon_social ?? 'Selecciona una empresa' }}
    </p>
  </div>
</div>
```

- [ ] **Step 3: Cambiar el recuadro grande de `fotoUrl` a `imagenUrl`**

En el mismo archivo, reemplazar el bloque (líneas 64-71):

```html
      @if (fotoUrl(); as foto) {
        <img [src]="foto" alt="Foto de la empresa" style="width:100%;height:100%;min-height:180px;object-fit:cover;border-radius:12px;border:1px solid rgba(34,33,33,.08);display:block" />
      } @else {
        <div style="min-height:180px;border-radius:12px;border:1.5px dashed #d1d5db;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;color:#9ca3af">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style="font-size:.72rem;font-weight:600">Sin foto</span>
        </div>
      }
```

por:

```html
      @if (imagenUrl(); as imagen) {
        <img [src]="imagen" alt="Imagen de la empresa" style="width:100%;height:100%;min-height:180px;object-fit:cover;border-radius:12px;border:1px solid rgba(34,33,33,.08);display:block" />
      } @else {
        <div style="min-height:180px;border-radius:12px;border:1.5px dashed #d1d5db;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;color:#9ca3af">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span style="font-size:.72rem;font-weight:600">Sin imagen</span>
        </div>
      }
```

- [ ] **Step 4: Verificar que compila**

Run: `cd front4 && npm run build`
Expected: termina sin errores.

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/features/dashboard/pages/mi-ficha-page.component.ts src/app/features/dashboard/pages/mi-ficha-page.component.html
git commit -m "fix(front4): Mi ficha muestra la imagen de portada, no el logo mal etiquetado"
```

---

### Task 8: Verificación manual end-to-end

**Files:** ninguno (solo verificación, no hay cambios de código).

**Interfaces:**
- Consumes: todo lo anterior, en vivo.

- [ ] **Step 1: Levantar backend y frontend**

Run: `cd back4 && npm run start:dev` (dejar corriendo en background)
Run: `cd front4 && npm start` (dejar corriendo en background)
Expected: back4 en `http://localhost:3000/api/v1`, front4 en `http://localhost:4200`.

- [ ] **Step 2: Crear empresa con logo e imagen**

En el navegador, iniciar sesión como `super_admin`, ir a `/empresa`, crear una empresa nueva seleccionando un archivo para "Logo" y otro para "Imagen de portada" en los dos paneles del formulario.
Expected: la empresa se crea, el status banner muestra "Empresa creada correctamente", y al reabrir el formulario en modo edición ambos paneles muestran su preview correspondiente (no el mismo archivo en los dos).

- [ ] **Step 3: Editar reemplazando solo uno de los dos campos**

Editar la empresa recién creada, cambiar solo la "Imagen de portada" (dejar el logo intacto), guardar.
Expected: al reabrir, el logo sigue siendo el original y la imagen de portada es la nueva.

- [ ] **Step 4: Verificar "Mi ficha" en modo consumidor**

Cambiar a modo consumidor, seleccionar esa empresa, ir a `/mi-ficha`.
Expected: el recuadro grande de "Información general" muestra la imagen de portada (no el logo); junto al título "Mi ficha" aparece el logo como insignia pequeña de 40px.

- [ ] **Step 5: Verificar que `centro-form` sigue funcionando**

Ir a `/centros`, crear o editar un centro subiendo una foto.
Expected: el panel "Foto del centro" (ahora vía `ImageUploadComponent`) sigue mostrando preview y guardando la foto igual que antes de la migración.

- [ ] **Step 6: Detener los servidores**

Terminar los procesos de `back4`/`front4` iniciados en el Step 1.
