# Score SmartClarity Editable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir y editar el score SmartClarity (gráfico de araña, 5 vértices 1-10) por empresa y por centro de costos, editable solo por `admin_smartclarity` y `super_admin`.

**Architecture:** Se agrega el campo `score_smartclarity: number[]` a los schemas de `Cliente` y `CentroCosto`. Se añaden endpoints `PUT /.../score-smartclarity` en el backend. El frontend lee el score desde los objetos ya cargados y muestra edición inline en el recuadro 4 de mi-ficha y mis-centros.

**Tech Stack:** NestJS + Mongoose (backend), Angular 17 signals (frontend)

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `back4/src/clientes/clientes.schema.ts` | + campo `score_smartclarity` |
| `back4/src/clientes/clientes.dto.ts` | + `UpdateScoreSmartclarityDto` |
| `back4/src/clientes/clientes.service.ts` | + método `updateScoreSmartclarity` |
| `back4/src/clientes/clientes.controller.ts` | + endpoint `PUT /:id/score-smartclarity` |
| `back4/src/centros-costos/centros-costos.schema.ts` | + campo `score_smartclarity` |
| `back4/src/centros-costos/centros-costos.dto.ts` | + `UpdateScoreSmartclarityDto` |
| `back4/src/centros-costos/centros-costos.service.ts` | + método `updateScoreSmartclarity` |
| `back4/src/centros-costos/centros-costos.controller.ts` | + endpoint `PUT /:centroId/score-smartclarity` |
| `front4/src/app/shared/models/cliente.model.ts` | + `score_smartclarity?: number[]` |
| `front4/src/app/shared/models/centro.model.ts` | + `score_smartclarity?: number[]` |
| `front4/src/app/features/clientes/clientes.service.ts` | + `updateScoreSmartclarity` |
| `front4/src/app/features/centros/centros.service.ts` | + `updateScoreSmartclarity` |
| `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts` | signals + edición inline |
| `front4/src/app/features/dashboard/pages/mi-ficha-page.component.html` | recuadro 4 con modo edición |
| `front4/src/app/features/centros/pages/mis-centros-page.component.ts` | signals + edición inline |
| `front4/src/app/features/centros/pages/mis-centros-page.component.html` | recuadro 4 con modo edición |

---

### Task 1: Schema Cliente — agregar score_smartclarity

**Files:**
- Modify: `back4/src/clientes/clientes.schema.ts`

- [ ] **Step 1: Agregar campo al schema**

Abrir `back4/src/clientes/clientes.schema.ts` y agregar la propiedad `score_smartclarity` dentro de la clase `Cliente`:

```ts
@Schema({ collection: 'clientes', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Cliente {
  @Prop({ required: true, trim: true }) razon_social: string;
  @Prop({ required: true, unique: true, trim: true }) rut: string;
  @Prop({ required: true, lowercase: true, trim: true }) email_contacto: string;
  @Prop({ trim: true }) telefono?: string;
  @Prop({
    type: {
      calle: String,
      ciudad: String,
      region: String,
      pais: { type: String, default: 'Chile' },
    },
  })
  direccion?: {
    calle?: string;
    ciudad?: string;
    region?: string;
    pais?: string;
  };
  @Prop({ default: true }) activo: boolean;
  @Prop({
    type: {
      contenido: Buffer,
      tipo_mime: String,
      nombre: String,
    },
  })
  logo?: { contenido: Buffer; tipo_mime: string; nombre: string };
  @Prop({ type: [DocumentoEmpresa], default: [] }) documentos: DocumentoEmpresa[];
  @Prop({ type: [Number], default: [5, 5, 5, 5, 5] }) score_smartclarity: number[];
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add back4/src/clientes/clientes.schema.ts
git commit -m "feat(back): add score_smartclarity to Cliente schema"
```

---

### Task 2: Schema CentroCosto — agregar score_smartclarity

**Files:**
- Modify: `back4/src/centros-costos/centros-costos.schema.ts`

- [ ] **Step 1: Agregar campo al schema**

Abrir `back4/src/centros-costos/centros-costos.schema.ts` y agregar la propiedad al final de la clase `CentroCosto`:

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
  @Prop({ default: true }) activo: boolean;
  @Prop({ type: [Documento], default: [] }) documentos: Documento[];
  @Prop({ type: [Number], default: [5, 5, 5, 5, 5] }) score_smartclarity: number[];
}
```

- [ ] **Step 2: Commit**

```bash
git add back4/src/centros-costos/centros-costos.schema.ts
git commit -m "feat(back): add score_smartclarity to CentroCosto schema"
```

---

### Task 3: Backend — DTO, service y endpoint para empresa

**Files:**
- Modify: `back4/src/clientes/clientes.dto.ts`
- Modify: `back4/src/clientes/clientes.service.ts`
- Modify: `back4/src/clientes/clientes.controller.ts`

- [ ] **Step 1: Agregar DTO en clientes.dto.ts**

Agregar al final del archivo `back4/src/clientes/clientes.dto.ts`:

```ts
import {
  IsString, IsEmail, IsOptional, IsBoolean,
  MinLength, ValidateNested, IsObject,
  IsArray, ArrayMinSize, ArrayMaxSize, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

class DireccionDto {
  @IsString() @IsOptional() calle?: string;
  @IsString() @IsOptional() ciudad?: string;
  @IsString() @IsOptional() region?: string;
  @IsString() @IsOptional() pais?: string;
}

export class CreateClienteDto {
  @IsString() @MinLength(3) razon_social: string;
  @IsString() @MinLength(9) rut: string;
  @IsEmail() email_contacto: string;
  @IsString() @IsOptional() telefono?: string;
  @IsObject() @IsOptional() @ValidateNested() @Type(() => DireccionDto)
  direccion?: DireccionDto;
}

export class UpdateClienteDto extends PartialType(CreateClienteDto) {
  @IsBoolean() @IsOptional() activo?: boolean;
  @IsString() @IsOptional() logo_url?: string;
}

export class UpdateScoreSmartclarityDto {
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(10, { each: true })
  valores: number[];
}
```

- [ ] **Step 2: Agregar método en clientes.service.ts**

Agregar después del método `remove` en `back4/src/clientes/clientes.service.ts`:

```ts
async updateScoreSmartclarity(id: string, valores: number[]) {
  const cliente = await this.clienteModel
    .findByIdAndUpdate(id, { score_smartclarity: valores }, { new: true, runValidators: true })
    .select('-logo.contenido -documentos.contenido')
    .lean();
  if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
  return cliente;
}
```

- [ ] **Step 3: Agregar endpoint en clientes.controller.ts**

Agregar el import del DTO en `back4/src/clientes/clientes.controller.ts`:

```ts
import { CreateClienteDto, UpdateClienteDto, UpdateScoreSmartclarityDto } from './clientes.dto';
```

Agregar el endpoint después del `@Put(':id')` existente:

```ts
@Put(':id/score-smartclarity')
@Roles('super_admin', 'admin_smartclarity')
updateScore(
  @Param('id') id: string,
  @Body() dto: UpdateScoreSmartclarityDto,
) {
  return this.clientesService.updateScoreSmartclarity(id, dto.valores);
}
```

- [ ] **Step 4: Commit**

```bash
git add back4/src/clientes/clientes.dto.ts back4/src/clientes/clientes.service.ts back4/src/clientes/clientes.controller.ts
git commit -m "feat(back): PUT /empresas/:id/score-smartclarity endpoint"
```

---

### Task 4: Backend — DTO, service y endpoint para centros

**Files:**
- Modify: `back4/src/centros-costos/centros-costos.dto.ts`
- Modify: `back4/src/centros-costos/centros-costos.service.ts`
- Modify: `back4/src/centros-costos/centros-costos.controller.ts`

- [ ] **Step 1: Agregar DTO en centros-costos.dto.ts**

Agregar al final del archivo `back4/src/centros-costos/centros-costos.dto.ts`:

```ts
import {
  IsString, IsOptional, IsBoolean,
  IsMongoId, MinLength,
  IsArray, ArrayMinSize, ArrayMaxSize, IsInt, Min, Max,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateCentroCostoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;
  @IsString() @MinLength(2) codigo: string;
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsString() @IsOptional() ubicacion_direccion?: string;
  @IsString() @IsOptional() ubicacion_ciudad?: string;
  @IsString() @IsOptional() ubicacion_region?: string;
  @IsString() @IsOptional() ubicacion_pais?: string;
}

export class UpdateCentroCostoDto extends PartialType(CreateCentroCostoDto) {
  @IsBoolean() @IsOptional() activo?: boolean;
}

export class UpdateScoreSmartclarityDto {
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(10, { each: true })
  valores: number[];
}
```

- [ ] **Step 2: Agregar método en centros-costos.service.ts**

Agregar después del método `update` en `back4/src/centros-costos/centros-costos.service.ts`:

```ts
async updateScoreSmartclarity(centroId: string, valores: number[]) {
  const centro = await this.centroCostoModel
    .findByIdAndUpdate(centroId, { score_smartclarity: valores }, { new: true, runValidators: true })
    .select('-documentos.contenido')
    .lean();
  if (!centro) throw new NotFoundException(`Centro ${centroId} no encontrado`);
  return centro;
}
```

- [ ] **Step 3: Agregar endpoint en centros-costos.controller.ts**

Agregar el import del DTO en `back4/src/centros-costos/centros-costos.controller.ts`:

```ts
import { CreateCentroCostoDto, UpdateCentroCostoDto, UpdateScoreSmartclarityDto } from './centros-costos.dto';
```

Agregar el endpoint después del `@Put(':centroId')` existente:

```ts
@Put(':centroId/score-smartclarity')
@Roles('super_admin', 'admin_smartclarity')
updateScore(
  @Param('centroId') centroId: string,
  @Body() dto: UpdateScoreSmartclarityDto,
) {
  return this.centrosCostosService.updateScoreSmartclarity(centroId, dto.valores);
}
```

- [ ] **Step 4: Commit**

```bash
git add back4/src/centros-costos/centros-costos.dto.ts back4/src/centros-costos/centros-costos.service.ts back4/src/centros-costos/centros-costos.controller.ts
git commit -m "feat(back): PUT /empresas/:id/centros/:centroId/score-smartclarity endpoint"
```

---

### Task 5: Frontend — modelos y servicios

**Files:**
- Modify: `front4/src/app/shared/models/cliente.model.ts`
- Modify: `front4/src/app/shared/models/centro.model.ts`
- Modify: `front4/src/app/features/clientes/clientes.service.ts`
- Modify: `front4/src/app/features/centros/centros.service.ts`

- [ ] **Step 1: Agregar campo en cliente.model.ts**

En `front4/src/app/shared/models/cliente.model.ts`, agregar `score_smartclarity` a la interfaz `Cliente`:

```ts
export interface Cliente {
  _id: string;
  razon_social: string;
  rut: string;
  email_contacto: string;
  telefono?: string;
  direccion?: Direccion;
  activo: boolean;
  logo?: { tipo_mime: string; nombre: string };
  logo_url?: string;
  score_smartclarity?: number[];
  creado_en?: string;
  actualizado_en?: string;
}
```

- [ ] **Step 2: Agregar campo en centro.model.ts**

En `front4/src/app/shared/models/centro.model.ts`, agregar `score_smartclarity` a la interfaz `CentroCosto`:

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
  activo: boolean;
  score_smartclarity?: number[];
  documentos?: DocumentoRef[];
  creado_en?: string;
  actualizado_en?: string;
}
```

- [ ] **Step 3: Agregar método en clientes.service.ts**

En `front4/src/app/features/clientes/clientes.service.ts`, agregar método después de `eliminar`. Acepta un callback `onComplete` para notificar al componente sin requerir `effect()`:

```ts
updateScoreSmartclarity(id: string, valores: number[], onComplete?: (ok: boolean) => void): void {
  this.http.put<Cliente>(
    this.api.url(`/empresas/${id}/score-smartclarity`),
    { valores }
  ).subscribe({
    next: (empresa) => {
      this.clientes.update(list => list.map(c => c._id === id ? { ...c, score_smartclarity: empresa.score_smartclarity } : c));
      this.status.set({ type: 'ok', text: 'Score actualizado' });
      if (onComplete) onComplete(true);
    },
    error: (err) => { this.setError(err); if (onComplete) onComplete(false); },
  });
}
```

- [ ] **Step 4: Agregar método en centros.service.ts**

En `front4/src/app/features/centros/centros.service.ts`, agregar método después de `actualizar`. Mismo patrón de callback:

```ts
updateScoreSmartclarity(empresaId: string, centroId: string, valores: number[], onComplete?: (ok: boolean) => void): void {
  this.http.put<CentroCosto>(
    this.api.url(`/empresas/${empresaId}/centros/${centroId}/score-smartclarity`),
    { valores }
  ).subscribe({
    next: (centro) => {
      this.centros.update(list => list.map(c => c._id === centroId ? { ...c, score_smartclarity: centro.score_smartclarity } : c));
      if (onComplete) onComplete(true);
    },
    error: (err) => { this.setError(err); if (onComplete) onComplete(false); },
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/shared/models/cliente.model.ts front4/src/app/shared/models/centro.model.ts front4/src/app/features/clientes/clientes.service.ts front4/src/app/features/centros/centros.service.ts
git commit -m "feat(front): models and services for score_smartclarity"
```

---

### Task 6: Frontend — mi-ficha edición inline

**Files:**
- Modify: `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts`
- Modify: `front4/src/app/features/dashboard/pages/mi-ficha-page.component.html`

- [ ] **Step 1: Actualizar el componente TypeScript**

Reemplazar las secciones relevantes de `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts`.

Cambiar el import de `@angular/core` para incluir `signal`:

```ts
import { Component, inject, computed, effect, untracked, signal } from '@angular/core';
```

Agregar import de `AuthService` y `FormsModule`:

```ts
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
```

Agregar `FormsModule` al array `imports` del `@Component`:

```ts
imports: [StatChipComponent, SpiderChartComponent, FormsModule],
```

Agregar `authService` a las inyecciones y reemplazar las propiedades del spider chart al final de la clase (antes de `readonly certificados`):

```ts
private readonly authService = inject(AuthService);
private readonly clientesService = inject(ClientesService);
```

Reemplazar las líneas:
```ts
readonly spiderLabels = [
  'RRHH y\ndocumentación',
  'Normativa',
  'Suministro',
  'Seguridad\nOperacional',
  'Continuidad\nOperacional',
];
readonly spiderValues = [72, 58, 84, 67, 75];
```

Por:
```ts
readonly spiderLabels = [
  'RRHH y\ndocumentación',
  'Normativa',
  'Suministro',
  'Seguridad\nOperacional',
  'Continuidad\nOperacional',
];

protected puedeEditar = computed(() => {
  const rol = this.authService.usuarioActual()?.rol;
  return rol === 'super_admin' || rol === 'admin_smartclarity';
});

protected spiderValues = computed<number[]>(() => {
  const emp = this.empresa();
  const raw = emp?.score_smartclarity;
  if (raw && raw.length === 5) return raw.map(v => v * 10);
  return [50, 50, 50, 50, 50];
});

protected editandoScore = signal(false);
protected guardandoScore = signal(false);
protected valoresEdit = signal<number[]>([5, 5, 5, 5, 5]);

protected iniciarEdicion(): void {
  const emp = this.empresa();
  const raw = emp?.score_smartclarity;
  this.valoresEdit.set(raw && raw.length === 5 ? [...raw] : [5, 5, 5, 5, 5]);
  this.editandoScore.set(true);
}

protected cancelarEdicion(): void {
  this.editandoScore.set(false);
}

protected guardarScore(): void {
  const emp = this.empresa();
  if (!emp) return;
  const vals = this.valoresEdit();
  if (vals.some(v => v < 1 || v > 10)) return;
  this.guardandoScore.set(true);
  this.clientesService.updateScoreSmartclarity(emp._id, vals, () => {
    this.guardandoScore.set(false);
    this.editandoScore.set(false);
  });
}
```

Agregar `ClientesService` import:
```ts
import { ClientesService } from '../../clientes/clientes.service';
```

- [ ] **Step 2: Actualizar el HTML — recuadro 4**

Localizar el bloque del recuadro 4 en `front4/src/app/features/dashboard/pages/mi-ficha-page.component.html`:

```html
<!-- Recuadro 4: Score gráfica de araña nivel empresa -->
<div class="card" style="display:flex;flex-direction:column">
  <h3 style="margin:0 0 .5rem;font-size:.95rem;font-weight:700;color:#1f2937">Score 2 — Evaluación SmartClarity</h3>
  <p style="margin:0 0 .5rem;font-size:.78rem;color:#6b7280">Nivel empresa</p>
  <div style="flex:1;display:flex;align-items:center;justify-content:center">
    <app-spider-chart
      [labels]="spiderLabels"
      [values]="spiderValues"
      [size]="260">
    </app-spider-chart>
  </div>
</div>
```

Reemplazarlo por:

```html
<!-- Recuadro 4: Score gráfica de araña nivel empresa -->
<div class="card" style="display:flex;flex-direction:column">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:.5rem">
    <div>
      <h3 style="margin:0 0 .2rem;font-size:.95rem;font-weight:700;color:#1f2937">Score 2 — Evaluación SmartClarity</h3>
      <p style="margin:0;font-size:.78rem;color:#6b7280">Nivel empresa</p>
    </div>
    @if (puedeEditar() && !editandoScore()) {
      <button
        (click)="iniciarEdicion()"
        title="Editar score"
        style="background:none;border:none;cursor:pointer;padding:.3rem;color:#6b7280;line-height:1">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    }
  </div>

  @if (!editandoScore()) {
    <div style="flex:1;display:flex;align-items:center;justify-content:center">
      <app-spider-chart [labels]="spiderLabels" [values]="spiderValues()" [size]="260"></app-spider-chart>
    </div>
  } @else {
    <div style="display:flex;flex-direction:column;gap:.6rem;margin-top:.5rem">
      @for (label of spiderLabels; track $index) {
        <div style="display:flex;align-items:center;gap:.75rem">
          <span style="font-size:.78rem;color:#374151;min-width:130px;flex-shrink:0">{{ label }}</span>
          <input
            type="number" min="1" max="10"
            [value]="valoresEdit()[$index]"
            (input)="valoresEdit.update(v => { const c = [...v]; c[$index] = +$any($event.target).value; return c; })"
            style="width:60px;padding:.3rem .4rem;border:1px solid #d1d5db;border-radius:6px;font-size:.85rem;text-align:center">
          <span style="font-size:.75rem;color:#6b7280">→ {{ valoresEdit()[$index] * 10 }}%</span>
        </div>
      }
      <div style="display:flex;gap:.5rem;margin-top:.4rem">
        <button
          (click)="guardarScore()"
          [disabled]="guardandoScore() || valoresEdit().some(v => v < 1 || v > 10)"
          style="padding:.4rem 1rem;background:#0095d6;color:#fff;border:none;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit"
          [style.opacity]="guardandoScore() ? '0.6' : '1'">
          {{ guardandoScore() ? 'Guardando…' : 'Guardar' }}
        </button>
        <button
          (click)="cancelarEdicion()"
          [disabled]="guardandoScore()"
          style="padding:.4rem 1rem;background:none;border:1px solid #d1d5db;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;color:#374151;font-family:inherit">
          Cancelar
        </button>
      </div>
    </div>
  }
</div>
```

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts front4/src/app/features/dashboard/pages/mi-ficha-page.component.html
git commit -m "feat(front): score SmartClarity editable inline en mi-ficha"
```

---

### Task 7: Frontend — mis-centros edición inline

**Files:**
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.ts`
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.html`

- [ ] **Step 1: Actualizar el componente TypeScript**

En `front4/src/app/features/centros/pages/mis-centros-page.component.ts`:

Agregar `AuthService` a los imports:
```ts
import { AuthService } from '../../auth/auth.service';
```

Asegurarse de que `signal` esté en el import de `@angular/core` (ya está):
```ts
import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
```

Agregar la inyección de `authService` en la clase (junto a los demás `inject`):
```ts
private readonly authService = inject(AuthService);
```

Reemplazar:
```ts
// ── Spider chart data (mock por ahora) ──────────────────────────────────
readonly spiderLabels = [
  'RRHH y\ndocumentación',
  'Normativa',
  'Suministro',
  'Seguridad\nOperacional',
  'Continuidad\nOperacional',
];
readonly spiderValues = [72, 58, 84, 67, 75];
```

Por:
```ts
readonly spiderLabels = [
  'RRHH y\ndocumentación',
  'Normativa',
  'Suministro',
  'Seguridad\nOperacional',
  'Continuidad\nOperacional',
];

protected puedeEditar = computed(() => {
  const rol = this.authService.usuarioActual()?.rol;
  return rol === 'super_admin' || rol === 'admin_smartclarity';
});

protected spiderValues = computed<number[]>(() => {
  const centro = this.service.seleccionado();
  const raw = centro?.score_smartclarity;
  if (raw && raw.length === 5) return raw.map(v => v * 10);
  return [50, 50, 50, 50, 50];
});

protected editandoScore = signal(false);
protected guardandoScore = signal(false);
protected valoresEdit = signal<number[]>([5, 5, 5, 5, 5]);

protected iniciarEdicion(): void {
  const centro = this.service.seleccionado();
  const raw = centro?.score_smartclarity;
  this.valoresEdit.set(raw && raw.length === 5 ? [...raw] : [5, 5, 5, 5, 5]);
  this.editandoScore.set(true);
}

protected cancelarEdicion(): void {
  this.editandoScore.set(false);
}

protected guardarScore(): void {
  const centro = this.service.seleccionado();
  if (!centro) return;
  const vals = this.valoresEdit();
  if (vals.some(v => v < 1 || v > 10)) return;
  this.guardandoScore.set(true);
  this.service.updateScoreSmartclarity(String(centro.cliente_id), centro._id, vals, () => {
    this.guardandoScore.set(false);
    this.editandoScore.set(false);
  });
}
```

El import de `@angular/core` ya tiene `signal` y `computed`. No se necesita `effect` ni `untracked`.

- [ ] **Step 2: Actualizar el HTML — recuadro 4**

Localizar el bloque del recuadro 4 en `front4/src/app/features/centros/pages/mis-centros-page.component.html`:

```html
<!-- Recuadro 4: Gráfica de araña -->
<div class="card" style="min-height:220px;display:flex;flex-direction:column">
  <h3 style="margin:0 0 .5rem;font-size:.95rem;font-weight:700;color:#1f2937">Score 2 — Evaluación SmartClarity</h3>
  <div style="flex:1;display:flex;align-items:center;justify-content:center">
    <app-spider-chart
      [labels]="spiderLabels"
      [values]="spiderValues"
      [size]="260">
    </app-spider-chart>
  </div>
</div>
```

Reemplazarlo por:

```html
<!-- Recuadro 4: Gráfica de araña -->
<div class="card" style="min-height:220px;display:flex;flex-direction:column">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:.5rem">
    <h3 style="margin:0;font-size:.95rem;font-weight:700;color:#1f2937">Score 2 — Evaluación SmartClarity</h3>
    @if (puedeEditar() && !editandoScore()) {
      <button
        (click)="iniciarEdicion()"
        title="Editar score"
        style="background:none;border:none;cursor:pointer;padding:.3rem;color:#6b7280;line-height:1">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    }
  </div>

  @if (!editandoScore()) {
    <div style="flex:1;display:flex;align-items:center;justify-content:center">
      <app-spider-chart [labels]="spiderLabels" [values]="spiderValues()" [size]="260"></app-spider-chart>
    </div>
  } @else {
    <div style="display:flex;flex-direction:column;gap:.6rem;margin-top:.5rem">
      @for (label of spiderLabels; track $index) {
        <div style="display:flex;align-items:center;gap:.75rem">
          <span style="font-size:.78rem;color:#374151;min-width:130px;flex-shrink:0">{{ label }}</span>
          <input
            type="number" min="1" max="10"
            [value]="valoresEdit()[$index]"
            (input)="valoresEdit.update(v => { const c = [...v]; c[$index] = +$any($event.target).value; return c; })"
            style="width:60px;padding:.3rem .4rem;border:1px solid #d1d5db;border-radius:6px;font-size:.85rem;text-align:center">
          <span style="font-size:.75rem;color:#6b7280">→ {{ valoresEdit()[$index] * 10 }}%</span>
        </div>
      }
      <div style="display:flex;gap:.5rem;margin-top:.4rem">
        <button
          (click)="guardarScore()"
          [disabled]="guardandoScore() || valoresEdit().some(v => v < 1 || v > 10)"
          style="padding:.4rem 1rem;background:#0095d6;color:#fff;border:none;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit"
          [style.opacity]="guardandoScore() ? '0.6' : '1'">
          {{ guardandoScore() ? 'Guardando…' : 'Guardar' }}
        </button>
        <button
          (click)="cancelarEdicion()"
          [disabled]="guardandoScore()"
          style="padding:.4rem 1rem;background:none;border:1px solid #d1d5db;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;color:#374151;font-family:inherit">
          Cancelar
        </button>
      </div>
    </div>
  }
</div>
```

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/features/centros/pages/mis-centros-page.component.ts front4/src/app/features/centros/pages/mis-centros-page.component.html
git commit -m "feat(front): score SmartClarity editable inline en mis-centros"
```
