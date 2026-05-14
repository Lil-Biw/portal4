# Documentos — Mejoras de Upload y Filtro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir subir cualquier formato de archivo, asignar categoría y nombre personalizado al documento, y filtrar la lista por categoría.

**Architecture:** El backend guarda un `metadata.json` por directorio de uploads que asocia cada filename con `{ nombre_display, categoria }`. El listado lee ese JSON para devolver los campos extra. El frontend agrega un panel inline de "Subir" (con campos nombre y categoría) y un filtro "Buscar" que filtra la lista localmente por categoría.

**Tech Stack:** NestJS (backend), Angular 21 standalone + Signals (frontend), filesystem JSON para metadata.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `portal-api/src/documentos/documentos.dto.ts` | Modificar | Agregar `nombre_display`, `categoria` |
| `portal-api/src/documentos/documentos.service.ts` | Modificar | Leer/escribir `metadata.json`, eliminar restricción PDF, filtrar por categoría |
| `portal-api/src/documentos/documentos.controller.ts` | Modificar | Exponer `categoria` como query param en listar |
| `front4/src/app/features/documentos/documentos.service.ts` | Modificar | Eliminar validación PDF, pasar `nombre_display`/`categoria`, signal de filtro |
| `front4/src/app/features/documentos/pages/documentos-page.component.ts` | Modificar | Estado para paneles inline, nombre, categoría, filtro |
| `front4/src/app/features/documentos/pages/documentos-page.component.html` | Modificar | Botones Subir/Buscar, panel inline upload, panel filtro, badges categoría |

---

### Task 1: Backend — Extender DTO con nombre_display y categoria

**Files:**
- Modify: `portal-api/src/documentos/documentos.dto.ts`

- [ ] **Step 1: Modificar el DTO**

Reemplazar todo el contenido de `portal-api/src/documentos/documentos.dto.ts`:

```typescript
import { IsMongoId, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const CATEGORIAS_DOCUMENTO = [
  'Contrato',
  'Factura',
  'Boleta',
  'Recibo',
  'Certificado',
  'Informe',
  'Otro',
] as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

export class SubirDocumentoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;
  @IsEnum(['empresa', 'centro', 'proyecto']) tipo: 'empresa' | 'centro' | 'proyecto';
  @IsMongoId() @IsOptional() centro_id?: string;
  @IsMongoId() @IsOptional() proyecto_id?: string;
  @IsOptional() empresa_nombre?: string;
  @IsOptional() centro_nombre?: string;
  @IsOptional() proyecto_nombre?: string;
  @IsOptional() @IsString() @MaxLength(200) nombre_display?: string;
  @IsOptional() @IsString() categoria?: string;
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/portal-api
git add src/documentos/documentos.dto.ts
git commit -m "feat(documentos): add nombre_display and categoria to DTO"
```

---

### Task 2: Backend — Service: metadata.json + aceptar todos los formatos

**Files:**
- Modify: `portal-api/src/documentos/documentos.service.ts`

- [ ] **Step 1: Reemplazar el service completo**

Reemplazar todo el contenido de `portal-api/src/documentos/documentos.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as multer from 'multer';
import { CentrosCostosService } from '../centros-costos/centros-costos.service';
import { ProyectosService } from '../proyectos/proyectos.service';

interface DocMeta {
  nombre_display: string;
  categoria: string;
}

interface MetadataMap {
  [filename: string]: DocMeta;
}

@Injectable()
export class DocumentosService {
  private readonly baseDir = path.join(process.cwd(), 'uploads');

  constructor(
    private readonly centrosService: CentrosCostosService,
    private readonly proyectosService: ProyectosService,
  ) {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getContextPath(
    tipo: 'empresa' | 'centro' | 'proyecto',
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
  ): string {
    const base = empresa_nombre || 'empresa';
    if (tipo === 'centro' && centro_nombre) {
      return path.join(base, 'centros-costos', centro_nombre, 'documentos');
    }
    if (tipo === 'proyecto' && centro_nombre && proyecto_nombre) {
      return path.join(base, 'centros-costos', centro_nombre, 'proyectos', proyecto_nombre);
    }
    return path.join(base, 'documentos');
  }

  private getMetaPath(dirPath: string): string {
    return path.join(dirPath, 'metadata.json');
  }

  private readMeta(dirPath: string): MetadataMap {
    const metaPath = this.getMetaPath(dirPath);
    if (!fs.existsSync(metaPath)) return {};
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as MetadataMap;
    } catch {
      return {};
    }
  }

  private writeMeta(dirPath: string, meta: MetadataMap): void {
    fs.writeFileSync(this.getMetaPath(dirPath), JSON.stringify(meta, null, 2), 'utf-8');
  }

  async subirDocumento(
    tipo: 'empresa' | 'centro' | 'proyecto',
    archivo: multer.File,
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
    centro_id?: string,
    proyecto_id?: string,
    nombre_display?: string,
    categoria?: string,
  ): Promise<{ url: string; nombre: string; nombre_display: string; categoria: string; tamano_bytes: number; tipo_mime: string }> {
    const contextPath = this.getContextPath(tipo, empresa_nombre, centro_nombre, proyecto_nombre);
    const fullDirPath = path.join(this.baseDir, contextPath);

    if (!fs.existsSync(fullDirPath)) {
      fs.mkdirSync(fullDirPath, { recursive: true });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${randomString}_${archivo.originalname}`;
    const filePath = path.join(fullDirPath, nombre);

    fs.writeFileSync(filePath, archivo.buffer);

    const resolvedNombre = nombre_display?.trim() || archivo.originalname;
    const resolvedCategoria = categoria || 'Otro';

    const meta = this.readMeta(fullDirPath);
    meta[nombre] = { nombre_display: resolvedNombre, categoria: resolvedCategoria };
    this.writeMeta(fullDirPath, meta);

    const url = `/uploads/${contextPath}/${nombre}`.replace(/\\/g, '/');
    const result = {
      nombre,
      nombre_display: resolvedNombre,
      categoria: resolvedCategoria,
      url,
      tipo_mime: archivo.mimetype,
      tamano_bytes: archivo.size,
    };

    if (tipo === 'centro' && centro_id) {
      await this.centrosService.agregarDocumento(centro_id, {
        nombre: result.nombre,
        url: result.url,
        tipo_mime: result.tipo_mime,
        tamano_bytes: result.tamano_bytes,
      });
    } else if (tipo === 'proyecto' && proyecto_id) {
      await this.proyectosService.agregarDocumento(proyecto_id, {
        nombre: result.nombre,
        url: result.url,
        tipo_mime: result.tipo_mime,
        tamano_bytes: result.tamano_bytes,
      });
    }

    return result;
  }

  listarDocumentos(
    tipo: 'empresa' | 'centro' | 'proyecto',
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
    categoria?: string,
  ): { nombre: string; nombre_display: string; categoria: string; url: string; tamano_bytes: number; tipo_mime: string }[] {
    const contextPath = this.getContextPath(tipo, empresa_nombre, centro_nombre, proyecto_nombre);
    const fullDirPath = path.join(this.baseDir, contextPath);

    if (!fs.existsSync(fullDirPath)) return [];

    const meta = this.readMeta(fullDirPath);
    const files = fs.readdirSync(fullDirPath).filter(f => f !== 'metadata.json');

    const docs = files.map((filename) => {
      const filePath = path.join(fullDirPath, filename);
      const stats = fs.statSync(filePath);
      const fileMeta = meta[filename] ?? { nombre_display: filename, categoria: 'Otro' };
      const ext = path.extname(filename).toLowerCase();
      const mimeGuess = ext === '.pdf' ? 'application/pdf'
        : ext === '.xlsx' || ext === '.xls' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : ext === '.docx' || ext === '.doc' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : ext === '.png' ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
        : 'application/octet-stream';
      return {
        nombre: filename,
        nombre_display: fileMeta.nombre_display,
        categoria: fileMeta.categoria,
        url: `/uploads/${contextPath}/${filename}`.replace(/\\/g, '/'),
        tamano_bytes: stats.size,
        tipo_mime: mimeGuess,
      };
    });

    if (categoria && categoria !== 'Todos') {
      return docs.filter(d => d.categoria === categoria);
    }
    return docs;
  }

  eliminarDocumento(
    tipo: 'empresa' | 'centro' | 'proyecto',
    filename: string,
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
  ): boolean {
    const contextPath = this.getContextPath(tipo, empresa_nombre, centro_nombre, proyecto_nombre);
    const fullDirPath = path.join(this.baseDir, contextPath);
    const filePath = path.join(fullDirPath, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      const meta = this.readMeta(fullDirPath);
      delete meta[filename];
      this.writeMeta(fullDirPath, meta);
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/portal-api
git add src/documentos/documentos.service.ts
git commit -m "feat(documentos): support all file types, metadata.json for nombre_display and categoria"
```

---

### Task 3: Backend — Controller: exponer categoria en listar y pasar params al service

**Files:**
- Modify: `portal-api/src/documentos/documentos.controller.ts`

- [ ] **Step 1: Actualizar el controller**

Reemplazar todo el contenido de `portal-api/src/documentos/documentos.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { DocumentosService } from './documentos.service';
import { SubirDocumentoDto } from './documentos.dto';

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('archivo'))
  subirDocumento(
    @UploadedFile() archivo: multer.File,
    @Body() dto: SubirDocumentoDto,
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');

    return this.documentosService.subirDocumento(
      dto.tipo,
      archivo,
      dto.empresa_nombre,
      dto.centro_nombre,
      dto.proyecto_nombre,
      dto.centro_id,
      dto.proyecto_id,
      dto.nombre_display,
      dto.categoria,
    );
  }

  @Get('listar')
  listarDocumentos(
    @Query('tipo') tipo: 'empresa' | 'centro' | 'proyecto',
    @Query('empresa_nombre') empresa_nombre?: string,
    @Query('centro_nombre') centro_nombre?: string,
    @Query('proyecto_nombre') proyecto_nombre?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.documentosService.listarDocumentos(
      tipo,
      empresa_nombre,
      centro_nombre,
      proyecto_nombre,
      categoria,
    );
  }

  @Delete('eliminar/:filename')
  eliminarDocumento(
    @Param('filename') filename: string,
    @Query('tipo') tipo: 'empresa' | 'centro' | 'proyecto',
    @Query('empresa_nombre') empresa_nombre?: string,
    @Query('centro_nombre') centro_nombre?: string,
    @Query('proyecto_nombre') proyecto_nombre?: string,
  ) {
    const eliminado = this.documentosService.eliminarDocumento(
      tipo,
      filename,
      empresa_nombre,
      centro_nombre,
      proyecto_nombre,
    );
    return { eliminado, filename };
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/portal-api
git add src/documentos/documentos.controller.ts
git commit -m "feat(documentos): expose categoria query param in listarDocumentos"
```

---

### Task 4: Frontend — Actualizar DocumentosService

**Files:**
- Modify: `front4/src/app/features/documentos/documentos.service.ts`

- [ ] **Step 1: Reemplazar el service frontend**

Reemplazar todo el contenido de `front4/src/app/features/documentos/documentos.service.ts`:

```typescript
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Status } from '../../shared/models/status.model';
import { encodeQuery } from '../../shared/utils';

export const CATEGORIAS_DOCUMENTO = [
  'Contrato',
  'Factura',
  'Boleta',
  'Recibo',
  'Certificado',
  'Informe',
  'Otro',
] as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

export interface DocumentoItem {
  nombre: string;
  nombre_display: string;
  categoria: string;
  url: string;
  tipo_mime: string;
  tamano_bytes?: number;
}

export type DocTipo = 'empresa' | 'centro' | 'proyecto';

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly documentosEmpresa  = signal<DocumentoItem[]>([]);
  readonly documentosCentro   = signal<DocumentoItem[]>([]);
  readonly documentosProyecto = signal<DocumentoItem[]>([]);
  readonly uploadStatus = signal<Record<DocTipo, Status | null>>({
    empresa: null, centro: null, proyecto: null,
  });

  cargar(tipo: DocTipo, empresaNombre?: string, centroNombre?: string, proyectoNombre?: string): void {
    const qs = encodeQuery({ tipo, empresa_nombre: empresaNombre, centro_nombre: centroNombre, proyecto_nombre: proyectoNombre });
    this.http.get<DocumentoItem[]>(`${this.api.url('/documentos/listar')}?${qs}`).subscribe({
      next: (docs) => this.setDocs(tipo, docs),
      error: () => this.setDocs(tipo, []),
    });
  }

  subir(
    file: File,
    tipo: DocTipo,
    empresaNombre?: string,
    centroNombre?: string,
    proyectoNombre?: string,
    centroId?: string,
    proyectoId?: string,
    nombreDisplay?: string,
    categoria?: string,
  ): void {
    const form = new FormData();
    form.append('archivo', file);
    form.append('tipo', tipo);
    if (empresaNombre)  form.append('empresa_nombre', empresaNombre);
    if (centroNombre)   form.append('centro_nombre', centroNombre);
    if (proyectoNombre) form.append('proyecto_nombre', proyectoNombre);
    if (centroId)       form.append('centro_id', centroId);
    if (proyectoId)     form.append('proyecto_id', proyectoId);
    if (nombreDisplay)  form.append('nombre_display', nombreDisplay);
    if (categoria)      form.append('categoria', categoria);

    this.http.post(this.api.url('/documentos/upload'), form).subscribe({
      next: () => {
        this.setUploadStatus(tipo, { type: 'ok', text: `${nombreDisplay || file.name} cargado exitosamente` });
        this.cargar(tipo, empresaNombre, centroNombre, proyectoNombre);
      },
      error: (err) => this.setUploadStatus(tipo, { type: 'error', text: err?.error?.message ?? 'Error al cargar' }),
    });
  }

  eliminar(filename: string, tipo: DocTipo, empresaNombre?: string, centroNombre?: string, proyectoNombre?: string): void {
    const qs = encodeQuery({ tipo, empresa_nombre: empresaNombre, centro_nombre: centroNombre, proyecto_nombre: proyectoNombre });
    this.http.delete(`${this.api.url('/documentos/eliminar')}/${encodeURIComponent(filename)}?${qs}`).subscribe({
      next: () => {
        this.setUploadStatus(tipo, { type: 'ok', text: `${filename} eliminado` });
        this.cargar(tipo, empresaNombre, centroNombre, proyectoNombre);
      },
      error: (err) => this.setUploadStatus(tipo, { type: 'error', text: err?.error?.message ?? 'Error al eliminar' }),
    });
  }

  descargar(url: string): void {
    const fullUrl = url.startsWith('http') ? url : `${this.api.base}${url}`;
    window.open(fullUrl, '_blank');
  }

  private setDocs(tipo: DocTipo, docs: DocumentoItem[]): void {
    if (tipo === 'empresa')  this.documentosEmpresa.set(docs);
    if (tipo === 'centro')   this.documentosCentro.set(docs);
    if (tipo === 'proyecto') this.documentosProyecto.set(docs);
  }

  private setUploadStatus(tipo: DocTipo, status: Status): void {
    this.uploadStatus.update(prev => ({ ...prev, [tipo]: status }));
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4
git add src/app/features/documentos/documentos.service.ts
git commit -m "feat(documentos): extend service — all file types, nombre_display, categoria"
```

---

### Task 5: Frontend — Actualizar DocumentosPageComponent (TS)

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-page.component.ts`

- [ ] **Step 1: Reemplazar el componente TS**

Reemplazar todo el contenido de `front4/src/app/features/documentos/pages/documentos-page.component.ts`:

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO } from '../documentos.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { asId } from '../../../shared/utils';

interface PanelState {
  showUpload: boolean;
  showFilter: boolean;
  nombreInput: string;
  categoriaInput: string;
  filtroCategoria: string;
  selectedFile: File | null;
}

@Component({
  selector: 'app-documentos-page',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, StatusBannerComponent],
  templateUrl: './documentos-page.component.html',
})
export class DocumentosPageComponent implements OnInit {
  protected readonly service = inject(DocumentosService);
  protected readonly clientesService = inject(ClientesService);
  protected readonly centrosService = inject(CentrosService);
  protected readonly proyectosService = inject(ProyectosService);

  protected readonly categorias = CATEGORIAS_DOCUMENTO;

  protected selectedEmpresaId  = '';
  protected selectedCentroId   = '';
  protected selectedProyectoId = '';

  protected panels: Record<DocTipo, PanelState> = {
    empresa:  this.emptyPanel(),
    centro:   this.emptyPanel(),
    proyecto: this.emptyPanel(),
  };

  private emptyPanel(): PanelState {
    return { showUpload: false, showFilter: false, nombreInput: '', categoriaInput: 'Contrato', filtroCategoria: 'Todos', selectedFile: null };
  }

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
  }

  get centrosFiltrados() {
    if (!this.selectedEmpresaId) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === this.selectedEmpresaId);
  }

  get proyectosFiltrados() {
    if (!this.selectedEmpresaId || !this.selectedCentroId) return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === this.selectedEmpresaId && asId(p.centro_costo_id) === this.selectedCentroId
    );
  }

  get empresaNombre() { return this.clientesService.clientes().find(c => c._id === this.selectedEmpresaId)?.razon_social; }
  get centroNombre()  { return this.centrosService.centros().find(c => c._id === this.selectedCentroId)?.nombre; }
  get proyectoNombre(){ return this.proyectosService.proyectos().find(p => p._id === this.selectedProyectoId)?.nombre; }

  onEmpresaChange(): void {
    this.selectedCentroId = '';
    this.selectedProyectoId = '';
    this.service.cargar('empresa', this.empresaNombre);
  }

  onCentroChange(): void {
    this.selectedProyectoId = '';
    this.service.cargar('centro', this.empresaNombre, this.centroNombre);
  }

  onProyectoChange(): void {
    this.service.cargar('proyecto', this.empresaNombre, this.centroNombre, this.proyectoNombre);
  }

  toggleUpload(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showUpload = !p.showUpload;
    if (p.showUpload) p.showFilter = false;
    if (!p.showUpload) { p.selectedFile = null; p.nombreInput = ''; }
  }

  toggleFilter(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showFilter = !p.showFilter;
    if (p.showFilter) p.showUpload = false;
  }

  onFileSelected(ev: Event, tipo: DocTipo): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const p = this.panels[tipo];
    p.selectedFile = file;
    if (!p.nombreInput) p.nombreInput = file.name.replace(/\.[^/.]+$/, '');
  }

  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    if (!p.selectedFile) return;
    this.service.subir(
      p.selectedFile, tipo,
      this.empresaNombre, this.centroNombre, this.proyectoNombre,
      this.selectedCentroId || undefined,
      this.selectedProyectoId || undefined,
      p.nombreInput || undefined,
      p.categoriaInput || undefined,
    );
    p.selectedFile = null;
    p.nombreInput = '';
    p.showUpload = false;
  }

  docsFiltrados(tipo: DocTipo) {
    const filtro = this.panels[tipo].filtroCategoria;
    const docs = tipo === 'empresa' ? this.service.documentosEmpresa()
      : tipo === 'centro' ? this.service.documentosCentro()
      : this.service.documentosProyecto();
    if (!filtro || filtro === 'Todos') return docs;
    return docs.filter(d => d.categoria === filtro);
  }

  eliminar(filename: string, tipo: DocTipo): void {
    this.service.eliminar(filename, tipo, this.empresaNombre, this.centroNombre, this.proyectoNombre);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4
git add src/app/features/documentos/pages/documentos-page.component.ts
git commit -m "feat(documentos): panel state for upload form and category filter"
```

---

### Task 6: Frontend — Actualizar template HTML

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-page.component.html`

- [ ] **Step 1: Reemplazar el template completo**

Reemplazar todo el contenido de `front4/src/app/features/documentos/pages/documentos-page.component.html`:

```html
<h2 style="margin:0 0 1.25rem;font-size:1.5rem;font-weight:700;color:#1f2937">Documentos</h2>

<!-- Selectores de contexto -->
<div class="card" style="margin-bottom:1rem">
  <p style="margin:0 0 .75rem;font-size:.85rem;font-weight:600;color:#374151">Selecciona el contexto</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.75rem">
    <label class="field">
      <span>Empresa</span>
      <select [(ngModel)]="selectedEmpresaId" (ngModelChange)="onEmpresaChange()">
        <option value="">Todas</option>
        <option *ngFor="let c of clientesService.clientes()" [value]="c._id">{{ c.razon_social }}</option>
      </select>
    </label>
    <label class="field">
      <span>Centro de costos</span>
      <select [(ngModel)]="selectedCentroId" (ngModelChange)="onCentroChange()" [disabled]="!selectedEmpresaId">
        <option value="">Todos</option>
        <option *ngFor="let c of centrosFiltrados" [value]="c._id">{{ c.nombre }}</option>
      </select>
    </label>
    <label class="field">
      <span>Proyecto</span>
      <select [(ngModel)]="selectedProyectoId" (ngModelChange)="onProyectoChange()" [disabled]="!selectedCentroId">
        <option value="">Todos</option>
        <option *ngFor="let p of proyectosFiltrados" [value]="p._id">{{ p.nombre }}</option>
      </select>
    </label>
  </div>
</div>

<!-- Sección empresa -->
<div class="card" style="margin-bottom:1rem">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
    <h3 style="margin:0;font-size:.95rem;font-weight:700">Documentos de empresa</h3>
    <div style="display:flex;gap:.5rem">
      <button class="btn-primary" style="font-size:.8rem;padding:.45rem .9rem" (click)="toggleUpload('empresa')" [disabled]="!selectedEmpresaId">+ Subir</button>
      <button class="btn-ghost"   style="font-size:.8rem;padding:.45rem .9rem" (click)="toggleFilter('empresa')"  [disabled]="!selectedEmpresaId">Buscar ▾</button>
    </div>
  </div>

  <!-- Panel subir empresa -->
  <div *ngIf="panels['empresa'].showUpload" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:.5rem;padding:1rem;margin-bottom:.75rem">
    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:.75rem;align-items:end">
      <label class="field" style="margin:0">
        <span>Archivo</span>
        <input type="file" accept="*/*" (change)="onFileSelected($event,'empresa')" style="padding:.3rem" />
      </label>
      <label class="field" style="margin:0">
        <span>Nombre</span>
        <input type="text" [(ngModel)]="panels['empresa'].nombreInput" placeholder="Nombre del documento" />
      </label>
      <label class="field" style="margin:0">
        <span>Tipo</span>
        <select [(ngModel)]="panels['empresa'].categoriaInput">
          <option *ngFor="let cat of categorias" [value]="cat">{{ cat }}</option>
        </select>
      </label>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:.75rem">
      <button class="btn-primary" style="font-size:.8rem;padding:.45rem .9rem" (click)="confirmarSubida('empresa')" [disabled]="!panels['empresa'].selectedFile">Confirmar subida</button>
      <button class="btn-ghost"   style="font-size:.8rem;padding:.45rem .9rem" (click)="toggleUpload('empresa')">Cancelar</button>
    </div>
  </div>

  <!-- Panel filtro empresa -->
  <div *ngIf="panels['empresa'].showFilter" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
    <span style="font-size:.85rem;color:#6b7280">Filtrar por tipo:</span>
    <select [(ngModel)]="panels['empresa'].filtroCategoria" style="font-size:.85rem;padding:.3rem .6rem;border:1px solid #d1d5db;border-radius:.375rem">
      <option value="Todos">Todos</option>
      <option *ngFor="let cat of categorias" [value]="cat">{{ cat }}</option>
    </select>
  </div>

  <app-status-banner [status]="service.uploadStatus().empresa"></app-status-banner>
  <p *ngIf="docsFiltrados('empresa').length === 0" class="empty" style="margin-top:.5rem">Sin documentos.</p>
  <div *ngFor="let d of docsFiltrados('empresa')" style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid rgba(34,33,33,.07)">
    <div style="display:flex;align-items:center;gap:.5rem">
      <span style="font-size:.7rem;font-weight:600;padding:.2rem .5rem;border-radius:999px;background:#e0e7ff;color:#3730a3">{{ d.categoria }}</span>
      <span style="font-size:.875rem">{{ d.nombre_display }}</span>
    </div>
    <div style="display:flex;gap:.5rem">
      <button class="btn-ghost"   style="font-size:.78rem;padding:.35rem .7rem" (click)="service.descargar(d.url)">Descargar</button>
      <button class="btn-danger"  style="font-size:.78rem;padding:.35rem .7rem" (click)="eliminar(d.nombre,'empresa')">Eliminar</button>
    </div>
  </div>
</div>

<!-- Sección centro -->
<div class="card" style="margin-bottom:1rem" *ngIf="selectedEmpresaId">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
    <h3 style="margin:0;font-size:.95rem;font-weight:700">Documentos de centro de costos</h3>
    <div style="display:flex;gap:.5rem">
      <button class="btn-primary" style="font-size:.8rem;padding:.45rem .9rem" (click)="toggleUpload('centro')" [disabled]="!selectedCentroId">+ Subir</button>
      <button class="btn-ghost"   style="font-size:.8rem;padding:.45rem .9rem" (click)="toggleFilter('centro')"  [disabled]="!selectedCentroId">Buscar ▾</button>
    </div>
  </div>

  <!-- Panel subir centro -->
  <div *ngIf="panels['centro'].showUpload" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:.5rem;padding:1rem;margin-bottom:.75rem">
    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:.75rem;align-items:end">
      <label class="field" style="margin:0">
        <span>Archivo</span>
        <input type="file" accept="*/*" (change)="onFileSelected($event,'centro')" style="padding:.3rem" />
      </label>
      <label class="field" style="margin:0">
        <span>Nombre</span>
        <input type="text" [(ngModel)]="panels['centro'].nombreInput" placeholder="Nombre del documento" />
      </label>
      <label class="field" style="margin:0">
        <span>Tipo</span>
        <select [(ngModel)]="panels['centro'].categoriaInput">
          <option *ngFor="let cat of categorias" [value]="cat">{{ cat }}</option>
        </select>
      </label>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:.75rem">
      <button class="btn-primary" style="font-size:.8rem;padding:.45rem .9rem" (click)="confirmarSubida('centro')" [disabled]="!panels['centro'].selectedFile">Confirmar subida</button>
      <button class="btn-ghost"   style="font-size:.8rem;padding:.45rem .9rem" (click)="toggleUpload('centro')">Cancelar</button>
    </div>
  </div>

  <!-- Panel filtro centro -->
  <div *ngIf="panels['centro'].showFilter" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
    <span style="font-size:.85rem;color:#6b7280">Filtrar por tipo:</span>
    <select [(ngModel)]="panels['centro'].filtroCategoria" style="font-size:.85rem;padding:.3rem .6rem;border:1px solid #d1d5db;border-radius:.375rem">
      <option value="Todos">Todos</option>
      <option *ngFor="let cat of categorias" [value]="cat">{{ cat }}</option>
    </select>
  </div>

  <app-status-banner [status]="service.uploadStatus().centro"></app-status-banner>
  <p *ngIf="docsFiltrados('centro').length === 0" class="empty" style="margin-top:.5rem">Sin documentos.</p>
  <div *ngFor="let d of docsFiltrados('centro')" style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid rgba(34,33,33,.07)">
    <div style="display:flex;align-items:center;gap:.5rem">
      <span style="font-size:.7rem;font-weight:600;padding:.2rem .5rem;border-radius:999px;background:#e0e7ff;color:#3730a3">{{ d.categoria }}</span>
      <span style="font-size:.875rem">{{ d.nombre_display }}</span>
    </div>
    <div style="display:flex;gap:.5rem">
      <button class="btn-ghost"   style="font-size:.78rem;padding:.35rem .7rem" (click)="service.descargar(d.url)">Descargar</button>
      <button class="btn-danger"  style="font-size:.78rem;padding:.35rem .7rem" (click)="eliminar(d.nombre,'centro')">Eliminar</button>
    </div>
  </div>
</div>

<!-- Sección proyecto -->
<div class="card" *ngIf="selectedCentroId">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
    <h3 style="margin:0;font-size:.95rem;font-weight:700">Documentos de proyecto</h3>
    <div style="display:flex;gap:.5rem">
      <button class="btn-primary" style="font-size:.8rem;padding:.45rem .9rem" (click)="toggleUpload('proyecto')" [disabled]="!selectedProyectoId">+ Subir</button>
      <button class="btn-ghost"   style="font-size:.8rem;padding:.45rem .9rem" (click)="toggleFilter('proyecto')"  [disabled]="!selectedProyectoId">Buscar ▾</button>
    </div>
  </div>

  <!-- Panel subir proyecto -->
  <div *ngIf="panels['proyecto'].showUpload" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:.5rem;padding:1rem;margin-bottom:.75rem">
    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:.75rem;align-items:end">
      <label class="field" style="margin:0">
        <span>Archivo</span>
        <input type="file" accept="*/*" (change)="onFileSelected($event,'proyecto')" style="padding:.3rem" />
      </label>
      <label class="field" style="margin:0">
        <span>Nombre</span>
        <input type="text" [(ngModel)]="panels['proyecto'].nombreInput" placeholder="Nombre del documento" />
      </label>
      <label class="field" style="margin:0">
        <span>Tipo</span>
        <select [(ngModel)]="panels['proyecto'].categoriaInput">
          <option *ngFor="let cat of categorias" [value]="cat">{{ cat }}</option>
        </select>
      </label>
    </div>
    <div style="display:flex;gap:.5rem;margin-top:.75rem">
      <button class="btn-primary" style="font-size:.8rem;padding:.45rem .9rem" (click)="confirmarSubida('proyecto')" [disabled]="!panels['proyecto'].selectedFile">Confirmar subida</button>
      <button class="btn-ghost"   style="font-size:.8rem;padding:.45rem .9rem" (click)="toggleUpload('proyecto')">Cancelar</button>
    </div>
  </div>

  <!-- Panel filtro proyecto -->
  <div *ngIf="panels['proyecto'].showFilter" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
    <span style="font-size:.85rem;color:#6b7280">Filtrar por tipo:</span>
    <select [(ngModel)]="panels['proyecto'].filtroCategoria" style="font-size:.85rem;padding:.3rem .6rem;border:1px solid #d1d5db;border-radius:.375rem">
      <option value="Todos">Todos</option>
      <option *ngFor="let cat of categorias" [value]="cat">{{ cat }}</option>
    </select>
  </div>

  <app-status-banner [status]="service.uploadStatus().proyecto"></app-status-banner>
  <p *ngIf="docsFiltrados('proyecto').length === 0" class="empty" style="margin-top:.5rem">Sin documentos.</p>
  <div *ngFor="let d of docsFiltrados('proyecto')" style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid rgba(34,33,33,.07)">
    <div style="display:flex;align-items:center;gap:.5rem">
      <span style="font-size:.7rem;font-weight:600;padding:.2rem .5rem;border-radius:999px;background:#e0e7ff;color:#3730a3">{{ d.categoria }}</span>
      <span style="font-size:.875rem">{{ d.nombre_display }}</span>
    </div>
    <div style="display:flex;gap:.5rem">
      <button class="btn-ghost"   style="font-size:.78rem;padding:.35rem .7rem" (click)="service.descargar(d.url)">Descargar</button>
      <button class="btn-danger"  style="font-size:.78rem;padding:.35rem .7rem" (click)="eliminar(d.nombre,'proyecto')">Eliminar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4
git add src/app/features/documentos/pages/documentos-page.component.html
git commit -m "feat(documentos): add Subir/Buscar panels, categoria badge, nombre_display in list"
```

---

### Task 7: Verificar que compila y funciona

- [ ] **Step 1: Compilar frontend**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4
npm run build 2>&1 | tail -20
```

Esperado: `Build at: ... - Time: ...ms` sin errores TypeScript.

- [ ] **Step 2: Levantar backend y verificar**

```bash
cd /home/biw/Documentos/ECLARITI/portal-api
npm run start:dev 2>&1 | head -20
```

Esperado: `Application is running on: http://[::1]:3000`

- [ ] **Step 3: Levantar frontend y probar flujo**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4
npm start
```

Flujo a probar:
1. Seleccionar empresa → aparece sección "Documentos de empresa"
2. Click "**+ Subir**" → aparece panel con campos Archivo, Nombre, Tipo
3. Elegir un archivo que **no sea PDF** (ej: `.xlsx`, `.png`) → se debe aceptar
4. Escribir nombre personalizado → al subir, ese nombre debe aparecer en la lista
5. Click "**Buscar ▾**" → aparece dropdown de categorías
6. Seleccionar una categoría → lista se filtra mostrando solo esa categoría
7. Click "Eliminar" en un documento → se elimina correctamente
