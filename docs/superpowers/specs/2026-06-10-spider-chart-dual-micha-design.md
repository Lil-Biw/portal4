# Spec: Gráfico de araña dual en Mi Ficha

**Fecha:** 2026-06-10  
**Rama objetivo:** feat/restructuracion-rutas

## Resumen

El recuadro "Score 2 — Evaluación SmartClarity" en Mi Ficha pasa de mostrar un solo gráfico (configurable por admin) a mostrar dos polígonos superpuestos en el mismo gráfico:

1. **Gráfico configurable** — `cliente.score_smartclarity` (ya existe, editable por admin)
2. **Gráfico promedio** — promedio de `centros.score_smartclarity` de todos los centros de costo de la empresa (calculado client-side)

El admin controla si el consumidor ve el gráfico promedio mediante un toggle `mostrar_grafico_promedio` persistido en la base de datos por empresa.

## Decisiones de diseño

- **Visualización:** ambos polígonos superpuestos en el mismo SVG. Azul (`#0095d6`) = configurable; verde (`#22c55e`) punteado = promedio.
- **Leyenda:** pequeña, bajo el gráfico, visible solo cuando el promedio está activo.
- **Toggle admin:** en el header del recuadro "Score 2", junto al botón "Editar score" existente. Solo visible para `super_admin` y `admin_smartclarity`.
- **Cálculo del promedio:** client-side desde `centrosService.centros()` ya cargados. Sin nueva llamada HTTP.
- **Visibilidad consumidor:** ve el polígono promedio solo si `empresa.mostrar_grafico_promedio === true`.
- **Visibilidad admin:** siempre ve ambos polígonos (previsualización de lo que verá el consumidor).

## Backend

### Schema `Cliente` — nuevo campo

```ts
@Prop({ default: false }) mostrar_grafico_promedio: boolean;
```

### Nuevo endpoint

`PATCH /empresas/:id/config-grafico`

- **Body:** `{ mostrar_grafico_promedio: boolean }`
- **Guard:** `JwtAuthGuard` + rol `super_admin` o `admin_smartclarity`
- **Respuesta:** el documento `Cliente` actualizado
- **Ubicación:** `clientes.controller.ts`

## Frontend

### `shared/models/cliente.model.ts`

Agregar campo a la interfaz `Cliente`:
```ts
mostrar_grafico_promedio?: boolean;
```

### `features/clientes/clientes.service.ts`

Nuevo método `updateConfigGrafico`:
```ts
updateConfigGrafico(id: string, mostrarPromedio: boolean, onDone?: () => void): void {
  this.http.patch<Cliente>(this.api.url(`/empresas/${id}/config-grafico`), { mostrar_grafico_promedio: mostrarPromedio })
    .subscribe({
      next: empresa => {
        this.clientes.update(list => list.map(c => c._id === id ? { ...c, mostrar_grafico_promedio: empresa.mostrar_grafico_promedio } : c));
        onDone?.();
      },
      error: err => this.setError(err),
    });
}
```

### `shared/components/spider-chart/spider-chart.component.ts`

Agregar input opcional para segundo polígono:
```ts
@Input() valuesPromedio?: number[];  // si undefined o vacío, no dibuja segundo polígono
```

El segundo polígono usa `fill="rgba(34,197,94,.15)"`, `stroke="#22c55e"`, `stroke-dasharray="4,3"`.

Se agrega una leyenda SVG (o HTML debajo del SVG) cuando `valuesPromedio` tiene valores.

### `features/dashboard/pages/mi-ficha-page.component.ts`

**Computed `spiderValuesPromedio`:**
```ts
protected spiderValuesPromedio = computed<number[]>(() => {
  const centros = this.centrosDeEmpresa();
  if (centros.length === 0) return [];
  return Array.from({ length: 5 }, (_, i) =>
    Math.round(centros.reduce((s, c) => s + (c.score_smartclarity?.[i] ?? 5), 0) / centros.length) * 10
  );
});
```

**Computed `mostrarPromedio`:**
```ts
protected mostrarPromedio = computed(() => {
  const empId = this.empresa()?._id;
  const emp = empId ? (this.clientesService.clientes().find(c => c._id === empId) ?? this.empresa()) : null;
  return emp?.mostrar_grafico_promedio ?? false;
});
```

**Signal y método para el toggle:**
```ts
protected guardandoConfigGrafico = signal(false);

protected toggleMostrarPromedio(): void {
  const emp = this.empresa();
  if (!emp) return;
  this.guardandoConfigGrafico.set(true);
  this.clientesService.updateConfigGrafico(emp._id, !this.mostrarPromedio(), () => {
    this.guardandoConfigGrafico.set(false);
  });
}
```

### `features/dashboard/pages/mi-ficha-page.component.html`

**Header del recuadro Score 2** — agregar toggle junto al botón de editar:
```html
@if (puedeEditar()) {
  <!-- Toggle mostrar promedio -->
  <button (click)="toggleMostrarPromedio()" [disabled]="guardandoConfigGrafico()" ...>
    Promedio {{ mostrarPromedio() ? 'ON' : 'OFF' }}
  </button>
  <!-- Botón editar score (ya existe) -->
}
```

**Llamada al gráfico** — pasar `valuesPromedio` condicionalmente:
```html
<app-spider-chart
  [labels]="spiderLabels"
  [values]="spiderValues()"
  [valuesPromedio]="(puedeEditar() || mostrarPromedio()) ? spiderValuesPromedio() : undefined">
</app-spider-chart>
```

El admin siempre recibe `valuesPromedio`, el consumidor solo si `mostrarPromedio()` es `true`.

## Casos borde

- **Sin centros:** `spiderValuesPromedio()` devuelve `[]`. El `SpiderChartComponent` no dibuja el segundo polígono si el array está vacío.
- **Centros sin score configurado:** `score_smartclarity` tiene default `[5,5,5,5,5]` en el backend, por lo que siempre habrá valores.
- **Toggle guardando:** el botón se deshabilita durante la llamada PATCH para evitar doble-click.

## Archivos a modificar

### Backend (`back4/`)
- `src/clientes/clientes.schema.ts` — campo `mostrar_grafico_promedio`
- `src/clientes/clientes.controller.ts` — endpoint `PATCH /:id/config-grafico`
- `src/clientes/clientes.service.ts` — método de actualización del campo
- `src/clientes/clientes.dto.ts` — DTO `UpdateConfigGraficoDto`

### Frontend (`front4/`)
- `src/app/shared/models/cliente.model.ts`
- `src/app/features/clientes/clientes.service.ts`
- `src/app/shared/components/spider-chart/spider-chart.component.ts`
- `src/app/features/dashboard/pages/mi-ficha-page.component.ts`
- `src/app/features/dashboard/pages/mi-ficha-page.component.html`
