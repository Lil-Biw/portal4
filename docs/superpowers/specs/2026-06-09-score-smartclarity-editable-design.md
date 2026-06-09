# Score SmartClarity Editable — Diseño

**Fecha:** 2026-06-09
**Alcance:** Mi Ficha (empresa) y Mis Centros (centro de costos)
**Roles autorizados para editar:** `admin_smartclarity`, `super_admin`

---

## 1. Problema

El gráfico de araña (spider chart) en el recuadro 4 de Mi Ficha y Mis Centros muestra valores mock hardcodeados `[72, 58, 84, 67, 75]`. No hay forma de persistir valores reales por empresa ni por centro de costos.

---

## 2. Alcance

- **Incluido:** score SmartClarity de empresa (Mi Ficha) y de centro de costos (Mis Centros).
- **Excluido:** score de proyecto (queda para una iteración futura).
- **Excluido:** configuración de etiquetas de los vértices (son fijas: RRHH y documentación, Normativa, Suministro, Seguridad Operacional, Continuidad Operacional).

---

## 3. Modelo de datos

### 3.1 Schema `Cliente` (empresa)

Agregar campo:

```ts
@Prop({ type: [Number], default: [5, 5, 5, 5, 5] })
score_smartclarity: number[];
```

- Array de exactamente 5 enteros en rango [1, 10].
- Posición 0 → RRHH y documentación, 1 → Normativa, 2 → Suministro, 3 → Seguridad Operacional, 4 → Continuidad Operacional.
- Default 5 (= 50%) para nuevas empresas.

### 3.2 Schema `CentroCosto`

Agregar campo idéntico:

```ts
@Prop({ type: [Number], default: [5, 5, 5, 5, 5] })
score_smartclarity: number[];
```

---

## 4. API

### 4.1 Endpoint empresa

```
PUT /empresas/:id/score-smartclarity
```

- **Guard:** `JwtAuthGuard` + `@Roles('super_admin', 'admin_smartclarity')`
- **Body:** `{ valores: number[] }` — array de 5 enteros 1-10.
- **Validación:** longitud === 5, cada valor entre 1 y 10 (entero).
- **Respuesta 200:** empresa actualizada (sin documentos/logo para aligerar payload).
- **Respuesta 400:** si el array no tiene 5 elementos o algún valor está fuera de rango.

### 4.2 Endpoint centro de costos

```
PUT /empresas/:empresaId/centros/:centroId/score-smartclarity
```

- **Guard:** `JwtAuthGuard` + `EmpresaAccessGuard` + `@Roles('super_admin', 'admin_smartclarity')`
- **Body / Validación / Respuesta:** idéntico al de empresa.

### 4.3 Lectura

No se agregan endpoints de lectura. Los campos `score_smartclarity` se devuelven automáticamente en los GET existentes:
- `GET /empresas/:id`
- `GET /empresas/:empresaId/centros`

---

## 5. Frontend

### 5.1 Conversión de escala

```ts
// valor 1-10 → porcentaje 0-100 para SpiderChartComponent
const toPercent = (v: number) => v * 10;
```

### 5.2 Servicio `ClientesService`

Agregar método:

```ts
updateScoreSmartclarity(empresaId: string, valores: number[]): Observable<Cliente>
```

Llama a `PUT /empresas/:empresaId/score-smartclarity`.

### 5.3 Servicio `CentrosService`

Agregar método:

```ts
updateScoreSmartclarity(empresaId: string, centroId: string, valores: number[]): Observable<CentroCosto>
```

Llama a `PUT /empresas/:empresaId/centros/:centroId/score-smartclarity`.

### 5.4 Componente `mi-ficha-page`

**Estado:**
- `spiderValues` deja de ser `readonly` hardcodeado y pasa a una señal derivada del objeto empresa cargado.
- `editando = signal(false)` — controla el modo edición.
- `valoresEdit = signal<number[]>([...])` — copia local mientras se edita.
- `guardando = signal(false)` — bloquea el botón guardar durante la llamada HTTP.

**Visibilidad del botón de edición:**

```ts
protected puedeEditar = computed(() => {
  const rol = this.authService.usuarioActual()?.rol;
  return rol === 'super_admin' || rol === 'admin_smartclarity';
});
```

**Recuadro 4 — modo lectura:**
- Chart igual que hoy.
- Botón lápiz (icono) en esquina superior derecha, visible solo si `puedeEditar()`.

**Recuadro 4 — modo edición:**
- Se oculta el chart.
- Se muestran 5 filas: etiqueta del vértice + `<input type="number" min="1" max="10">`.
- Botón **Guardar** (llama al servicio → actualiza señal → `editando = false`).
- Botón **Cancelar** (descarta `valoresEdit`, `editando = false`).
- Durante el guardado: botones deshabilitados, spinner o texto "Guardando…".

### 5.5 Componente `mis-centros-page`

Mismo patrón que `mi-ficha-page`. Los valores del centro activo se leen de `centrosService.centros()` al seleccionar un centro.

---

## 6. Validación

- Frontend: los inputs tienen `min="1" max="10"` y el botón Guardar se deshabilita si algún valor está fuera de rango.
- Backend: DTO con `@IsArray()`, `@ArrayMinSize(5)`, `@ArrayMaxSize(5)`, `@Min(1)`, `@Max(10)`, `@IsInt()` en cada elemento.

---

## 7. Secuencia de implementación

1. Agregar `score_smartclarity` a los schemas de `Cliente` y `CentroCosto`.
2. Crear DTOs y endpoints PUT en backend.
3. Agregar métodos en `ClientesService` y `CentrosService` del frontend.
4. Actualizar `mi-ficha-page`: leer score desde empresa, modo edición inline.
5. Actualizar `mis-centros-page`: leer score desde centro seleccionado, modo edición inline.
