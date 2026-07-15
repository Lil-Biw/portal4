# Unificar recuadros de contexto en Documentos (admin)

**Fecha:** 2026-07-15
**Estado:** Aprobado

## Contexto / Problema

En `documentos-admin-page.component.html` la selección de contexto (empresa → centro
de costos → proyecto) vive hoy repartida en dos tarjetas separadas por un gap de 1rem:

1. **Recuadro "Selecciona el contexto"** (líneas ~3-41): grid de 3 `<select>`
   (Empresa / Centro de costos / Proyecto).
2. **Tarjeta A**: tab-strip con los mismos tres niveles (`tabJerarquia()`) + un bloque
   "subcontexto" debajo que repite, con ícono y borde de color, el nombre de lo que ya
   se eligió en el select correspondiente.

El resultado es que el mismo nombre de entidad puede aparecer hasta tres veces
(valor del select, label genérico del tab, nombre en el subcontexto), y visualmente se
leen como dos widgets en vez de un solo panel "arriba eliges, abajo ves el resultado".

## Solución aprobada

Una sola tarjeta (`.card`), sin cambios de lógica (mismos signals, mismos guards de
habilitación, mismos nombres computados). Estructura:

1. **Tab-strip** arriba, con el mismo color por nivel que ya existe en el código
   (empresa `#0095d6` / centro `#059669` sobre `rgba(16,185,129,.08)` / proyecto
   `#d97706` sobre `rgba(245,158,11,.08)`). Cada tab interpola el nombre real de la
   entidad elegida en ese nivel (`empresaNombre` / `centroNombre` / `proyectoNombre`)
   en lugar del label genérico fijo; mientras no hay selección en ese nivel, muestra el
   label genérico ("Centro de costo", "Proyecto").
2. Bajo el tab activo, un panel partido 50/50
   (`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`, el mismo patrón que
   ya usa el grid de selects actual — colapsa a una columna sola por debajo de ~480px
   sin breakpoint nuevo):
   - **Mitad izquierda — resumen del elegido**: es el bloque `subctx` que ya existe hoy
     (ícono + borde de color + nombre + metadata: RUT/ciudad para empresa, código/ciudad
     para centro, código/fechas para proyecto). No se reescribe, solo se reubica. Si no
     hay selección en el nivel activo, muestra el mismo placeholder de texto que hoy
     usan los `@if` vacíos ("Selecciona un centro de costos para ver su documentación.",
     etc.).
   - **Mitad derecha — cambiar selección**: el `<select>` de ese nivel, con el mismo
     binding que tiene hoy en el recuadro superior (`[(ngModel)]="selectedCentroId"` +
     `(ngModelChange)="onCentroChange()"`, etc.), solo reubicado.

El recuadro superior "Selecciona el contexto" (grid de 3 selects) se elimina por
completo — todo el picking pasa a vivir bajo el tab activo.

## Por qué esta forma y no otras

Se exploraron y descartaron durante el brainstorming (mockups no versionados, solo en
sesión):

- **Fusión visual mínima** (mismos selects arriba + tabs abajo, solo sin gap/doble
  borde): descartada por el usuario, seguía sintiéndose como dos widgets pegados.
- **Tabs con nombre real + subcontexto colapsado a una línea de caption** (sin panel
  partido): descartada, insuficiente — seguía sin resolver dónde vive el control para
  *cambiar* la selección.
- **Picker de tarjetas clicables coloreadas** (una fila por opción, con buscador
  arriba, reemplazando el `<select>` nativo): descartada porque con muchos centros o
  proyectos la lista de tarjetas crece demasiado en alto; el `<select>` nativo escala
  mejor para listas largas.

## Alcance

- Solo `documentos-admin-page.component.html` (y los helpers mínimos de
  `documentos-admin-page.component.ts` si el template necesita alguna función/getter
  nueva para resolver el label del tab con fallback).
- `documentos-consumidor-page.component.html` **no se toca** — mismo patrón duplicado
  existe ahí, pero el usuario decidió explícitamente dejarlo fuera de esta iteración.
- Sin cambios de backend.
- Sin cambios de lógica de negocio: mismos signals (`selectedEmpresaId`,
  `selectedCentroId`, `selectedProyectoId`, `tabJerarquia()`), mismos guards de
  habilitación de tabs (`[disabled]="!selectedCentroId"` etc.), mismas variables ya
  computadas (`empresaNombre`, `centroNombre`, `proyectoNombre`,
  `empresaSeleccionadaObj`, `centroSeleccionado`, `proyectoSeleccionado`).
- La "Tarjeta B" (sub-tabs Documentación / Solicitudes y su contenido) no se toca.

## Cambios concretos de plantilla

- Eliminar el `<div class="card" style="margin-bottom:1rem">` de "Selecciona el
  contexto" (líneas ~3-41 del archivo actual).
- En la Tarjeta A:
  - El texto de cada botón de tab pasa de literal fijo a interpolación con fallback,
    ej. `{{ centroNombre || 'Centro de costo' }}` (mismo patrón para proyecto; el tab
    de empresa siempre tiene nombre porque la página solo se muestra con empresa
    elegida).
  - Los cuatro bloques `@if (tabJerarquia() === '...')` que hoy arman el subcontexto
    pasan a envolver `<div class="split">` con dos hijos: el bloque de resumen existente
    (o su placeholder) a la izquierda, el `<select>` correspondiente a la derecha.
- Los colores por nivel no son paleta nueva — son los mismos valores inline que ya usan
  hoy los tabs y el borde del subcontexto.

## Fuera de alcance

- `documentos-consumidor-page.component.html`.
- Buscador/combobox para la lista de empresas — se evaluó (opción con lista de
  tarjetas + buscador) y se descartó a favor del `<select>` nativo, que ya soporta
  listas largas sin trabajo adicional.
- Cambios de responsive/accesibilidad más allá de reusar `repeat(auto-fit,
  minmax(240px, 1fr))` para el panel partido, igual que ya hace el grid de 3 selects
  hoy.
