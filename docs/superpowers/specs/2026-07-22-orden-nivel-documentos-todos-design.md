# Spec: Orden por nivel en tab "Todos" de Documentos (admin)

## Contexto

En `/documentos` (modo admin), el tab jerárquico "Todos" muestra una lista plana de
todos los documentos de todas las empresas/centros/proyectos, generada por el
`computed filasTodos` en `documentos-admin-page.component.ts:378`. Actualmente esa
lista solo se ordena alfabéticamente por `doc.nombre_display` (línea 413).

Se pide agregar un filtro de orden que permita, además del alfabético, agrupar los
resultados por nivel jerárquico (empresa, centro, proyecto).

## Requisitos

Cuatro modos de orden, seleccionables por el usuario en el panel "Todos los
documentos":

1. **Alfabético** (default, comportamiento actual sin cambios): ordena únicamente
   por `doc.nombre_display` con el collator `es` existente (`collatorNombre`).
2. **Nivel empresa**: agrupa las filas en el orden `empresa → centro → proyecto`
   (primero las filas cuyo `tipo` es `'empresa'`, luego `'centro'`, luego
   `'proyecto'`).
3. **Nivel centro**: agrupa en el orden `centro → proyecto → empresa`.
4. **Nivel proyecto**: agrupa en el orden `proyecto → empresa → centro`.

Dentro de cada grupo (para los 3 modos "nivel X"), el orden secundario es siempre
la cadena jerárquica completa: `empresaNombre → centroNombre → proyectoNombre →
doc.nombre_display`, comparada con `collatorNombre`. Esto es independiente del
modo activo — solo cambia qué grupo de `tipo` va primero, no el criterio de orden
dentro del grupo.

Ejemplo: en modo "nivel centro", el grupo de filas tipo `proyecto` se ordena por
empresa, luego centro, luego proyecto, luego nombre del documento — no solo por
nombre de proyecto.

## Diseño técnico

### Estado

Nuevo signal en `documentos-admin-page.component.ts`:

```ts
type OrdenTodos = 'alfabetico' | 'nivel_empresa' | 'nivel_centro' | 'nivel_proyecto';
protected ordenTodos = signal<OrdenTodos>('alfabetico');
```

No se persiste (ni localStorage ni query params); vuelve a `'alfabetico'` en cada
carga de página, igual que el resto de los filtros de esta vista.

### Orden — comparador

Se modifica el `computed filasTodos` (línea 378) para aplicar un comparador según
`ordenTodos()`, en vez del `sort` fijo actual (línea 413):

```ts
const RANGOS_POR_MODO: Record<Exclude<OrdenTodos, 'alfabetico'>, DocTipo[]> = {
  nivel_empresa:  ['empresa', 'centro', 'proyecto'],
  nivel_centro:   ['centro', 'proyecto', 'empresa'],
  nivel_proyecto: ['proyecto', 'empresa', 'centro'],
};

const modo = this.ordenTodos();
if (modo === 'alfabetico') {
  filas.sort((a, b) => collatorNombre.compare(a.doc.nombre_display, b.doc.nombre_display));
} else {
  const rango = RANGOS_POR_MODO[modo];
  filas.sort((a, b) =>
    (rango.indexOf(a.tipo) - rango.indexOf(b.tipo)) ||
    collatorNombre.compare(a.empresaNombre, b.empresaNombre) ||
    collatorNombre.compare(a.centroNombre ?? '', b.centroNombre ?? '') ||
    collatorNombre.compare(a.proyectoNombre ?? '', b.proyectoNombre ?? '') ||
    collatorNombre.compare(a.doc.nombre_display, b.doc.nombre_display)
  );
}
```

`filasTodos` sigue siendo el único punto de ordenamiento; no se duplica la lógica
en el template.

### UI

En `documentos-admin-page.component.html`, dentro del panel "Todos los
documentos" (líneas 130-146), debajo del texto "Empresas, centros de costos y
proyectos · N documentos", se agrega una fila de 4 chips:

- Alfabético
- Nivel empresa
- Nivel centro
- Nivel proyecto

Mismo patrón visual que los botones "Vigentes/Vencidos" ya existentes en el
archivo (líneas 378-401): botones en fila, borde y fondo resaltado con el acento
morado `#7c3aed` (color ya usado por este panel) cuando el chip está activo,
`#6b7280`/transparente cuando no. Click en un chip llama a
`this.ordenTodos.set(...)`; no dispara ningún request al backend (el orden es
100% client-side sobre `filasTodos`).

### Fuera de alcance

- No se persiste la preferencia de orden entre sesiones ni se agrega a la URL.
- No afecta a los demás tabs (`empresa`, `centro`, `proyecto`), que usan sus
  propios computeds y no tienen este selector.
- No se toca la búsqueda por nombre ni los filtros de categoría existentes —
  ambos siguen aplicándose antes del ordenamiento, sobre `busquedaCascada()`.

## Testing

- Test unitario (si existe suite para este componente) o verificación manual en
  el navegador:
  - Con documentos en los 3 niveles (empresa, centro, proyecto) para una misma
    empresa, alternar entre los 4 chips y confirmar que el agrupamiento y el
    orden secundario coinciden con lo especificado arriba.
  - Confirmar que cambiar de chip no dispara un nuevo GET (no hay parpadeo de
    loading ni llamada a `buscarCascada`).
  - Confirmar que el default al entrar al tab "Todos" sigue siendo alfabético.
