# Empresa "Todas" en Documentos (admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el select de Empresa en Documentos (admin) tenga una opción real "Todas" que muestre la documentación agregada de todas las empresas a nivel empresa/centro/proyecto, combinándose correctamente con los selects de Centro/Proyecto que ya soportan "Todos".

**Architecture:** El endpoint `GET /documentos/busqueda-total?nivel=empresa` (ya existe, backend sin cambios) devuelve el árbol completo de todas las empresas con centros y proyectos anidados. `DocumentosService` agrega un signal nuevo (`documentosTodasEmpresas`) que se carga **una sola vez** al elegir "Todas" (sin filtro de categoría/nombre); los 3 niveles de vista (empresa/centro/proyecto) se derivan de ese árbol en el cliente vía getters nuevos en `DocumentosAdminPageComponent`, reutilizando el filtro client-side (`panels[tipo]`) que ya existe para las vistas de una sola empresa. No se reutiliza el signal `busquedaCascada` existente (pertenece a la pestaña "Todos", que tiene su propio ciclo de filtro server-side) para no acoplar ambas features.

**Tech Stack:** Angular 21 standalone + signals, Vitest (`@angular/build:unit-test`), NestJS backend sin cambios.

## Global Constraints

- Sin `any` en código de producción.
- Con Empresa="Todas": Subir se deshabilita (no hay empresa destino); Eliminar/Vencer/Cambiar categoría de un documento puntual de la lista agregada siguen funcionando, resolviendo la empresa (y centro/proyecto) real por fila.
- Con Empresa="Todas": Solicitudes y Vencidos quedan fuera de alcance — muestran un mensaje pidiendo elegir una empresa específica, sin llamar al backend con un `empresa_id` inválido.
- Con Empresa="Todas": los selects de Centro y Proyecto solo ofrecen la opción "Todos" (nunca items sueltos de otra empresa) — para apuntar a un centro/proyecto puntual hay que elegir primero su empresa específica.
- Spec completo: `docs/superpowers/specs/2026-07-21-empresa-todas-documentos-design.md`.

---

## Task 1: `DocumentosService.cargarTodasEmpresas()`

**Files:**
- Modify: `front4/src/app/features/documentos/documentos.service.ts`
- Test: `front4/src/app/features/documentos/documentos.service.spec.ts`

**Interfaces:**
- Produces: `DocumentosService.documentosTodasEmpresas: Signal<NodoBusqueda[]>` y `DocumentosService.cargarTodasEmpresas(): void`, consumidos por `DocumentosAdminPageComponent` (Task 2).

- [ ] **Step 1: Escribir el test (fallará porque el método no existe)**

En `front4/src/app/features/documentos/documentos.service.spec.ts`, agregar un `describe` nuevo al final del archivo:

```ts
describe('DocumentosService.cargarTodasEmpresas', () => {
  let service: DocumentosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocumentosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('pega a /documentos/busqueda-total con nivel=empresa sin filtros, y arma la URL de cada documento del árbol', () => {
    service.cargarTodasEmpresas();

    const req = httpMock.expectOne(r => r.url.includes('/documentos/busqueda-total'));
    const url = new URL(req.request.url);
    expect(url.searchParams.get('nivel')).toBe('empresa');
    expect(url.searchParams.has('categorias')).toBe(false);
    expect(url.searchParams.has('nombre')).toBe(false);

    req.flush([
      {
        _id: 'emp1', nombre: 'Empresa Acme', nivel: 'empresa',
        empresa_id: 'emp1', empresa_nombre: 'Empresa Acme',
        documentos: [{ _id: 'doc1', nombre_display: 'Contrato Marco', categoria: 'Contratos' }],
        centros: [{
          _id: 'centro1', nombre: 'Centro Norte', nivel: 'centro',
          empresa_id: 'emp1', empresa_nombre: 'Empresa Acme',
          documentos: [{ _id: 'doc2', nombre_display: 'Contrato Centro', categoria: 'Contratos' }],
          centros: [],
          proyectos: [{
            _id: 'proy1', nombre: 'Proyecto Cableado', nivel: 'proyecto',
            empresa_id: 'emp1', empresa_nombre: 'Empresa Acme', centro_id: 'centro1', centro_nombre: 'Centro Norte',
            documentos: [{ _id: 'doc3', nombre_display: 'Contrato Proyecto', categoria: 'Contratos' }],
            centros: [], proyectos: [],
          }],
        }],
        proyectos: [],
      },
    ]);

    const arbol = service.documentosTodasEmpresas();
    expect(arbol[0].documentos[0].url).toContain('/empresas/emp1/documentos/doc1');
    expect(arbol[0].centros[0].documentos[0].url).toContain('/empresas/emp1/centros/centro1/documentos/doc2');
    expect(arbol[0].centros[0].proyectos[0].documentos[0].url).toContain('/empresas/emp1/centros/centro1/proyectos/proy1/documentos/doc3');
  });

  it('vacía documentosTodasEmpresas si la petición falla', () => {
    service.cargarTodasEmpresas();
    const req = httpMock.expectOne(r => r.url.includes('/documentos/busqueda-total'));
    req.flush('fallo', { status: 500, statusText: 'Internal Server Error' });
    expect(service.documentosTodasEmpresas()).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd front4 && npx ng test --watch=false --include=src/app/features/documentos/documentos.service.spec.ts`
Expected: FAIL — `service.cargarTodasEmpresas is not a function` (o `documentosTodasEmpresas` undefined).

- [ ] **Step 3: Agregar el signal y el método**

En `front4/src/app/features/documentos/documentos.service.ts`, agregar el signal junto a `busquedaCascadaError` (línea 104):

```ts
  readonly busquedaCascadaError = signal(false);
  readonly documentosTodasEmpresas = signal<NodoBusqueda[]>([]);
```

Agregar el método junto a `buscarCascada` (después de su cierre, línea 376):

```ts
  cargarTodasEmpresas(): void {
    this.http.get<NodoBusqueda[]>(this.api.url('/documentos/busqueda-total?nivel=empresa')).pipe(
      catchError(() => of([] as NodoBusqueda[])),
    ).subscribe(arbol => this.documentosTodasEmpresas.set(arbol.map(n => this.mapearNodo(n))));
  }
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd front4 && npx ng test --watch=false --include=src/app/features/documentos/documentos.service.spec.ts`
Expected: `Tests 8 passed (8)` (los 6 ya existentes + los 2 nuevos).

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/features/documentos/documentos.service.ts src/app/features/documentos/documentos.service.spec.ts
git commit -m "feat(front): DocumentosService.cargarTodasEmpresas para agregar documentos de todas las empresas"
```

---

## Task 2: Lógica del componente — getters, guards y acciones por fila

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`

**Interfaces:**
- Consumes: `service.documentosTodasEmpresas`, `service.cargarTodasEmpresas()` (Task 1).
- Produces: getters `docsEmpresaTodas()`, `docsCentroTodas()`, `docsProyectoTodas()`; métodos `eliminarEnTodasEmpresas`, `eliminarCentroEnTodasEmpresas`, `eliminarProyectoEnTodasEmpresas`, `seleccionarCategoriaTodasEmpresas`; y los guards de `puedeGestionarDocumento`, `centrosFiltrados`, `cargarVencidosAdmin`, `crearSolicitud`, `onEmpresaChange`, `onCentroChange`, `onProyectoChange`, `confirmarVencer` — todos consumidos por la plantilla en las Tasks 3-5.

- [ ] **Step 1: Actualizar `centrosFiltrados` para devolver todos los centros del sistema con Empresa="Todas"**

En `documentos-admin-page.component.ts:326-329`, reemplazar:

```ts
  get centrosFiltrados() {
    if (!this.selectedEmpresaId) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === this.selectedEmpresaId);
  }
```

por:

```ts
  get centrosFiltrados() {
    if (!this.selectedEmpresaId) return [];
    if (this.selectedEmpresaId === 'todos') return this.centrosService.centros();
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === this.selectedEmpresaId);
  }
```

- [ ] **Step 2: Actualizar `puedeGestionarDocumento` para exigir una empresa específica**

En `documentos-admin-page.component.ts:362-366`, reemplazar:

```ts
  get puedeGestionarDocumento(): boolean {
    return this.tabJerarquia() === 'empresa' ||
      (this.tabJerarquia() === 'centro'   && !!this.selectedCentroId   && this.selectedCentroId   !== 'todos') ||
      (this.tabJerarquia() === 'proyecto' && !!this.selectedProyectoId && this.selectedProyectoId !== 'todos');
  }
```

por:

```ts
  get puedeGestionarDocumento(): boolean {
    return (this.tabJerarquia() === 'empresa' && !!this.selectedEmpresaId && this.selectedEmpresaId !== 'todos') ||
      (this.tabJerarquia() === 'centro'   && !!this.selectedCentroId   && this.selectedCentroId   !== 'todos') ||
      (this.tabJerarquia() === 'proyecto' && !!this.selectedProyectoId && this.selectedProyectoId !== 'todos');
  }
```

- [ ] **Step 3: Actualizar `onEmpresaChange()` para cargar el árbol agregado o limpiar solicitudes**

En `documentos-admin-page.component.ts:449-463`, reemplazar:

```ts
  onEmpresaChange(): void {
    this.selectedCentroId = '';
    this.selectedProyectoId = '';
    this.tabJerarquia.set('empresa');
    this.tabAdminActiva.set('documentacion');
    this.tabDocAdmin.set('activos');
    this.service.documentosVencidos.set([]);
    this.service.documentosCentro.set([]);
    this.service.documentosProyecto.set([]);
    this.service.documentosPorCentro.set([]);
    this.service.documentosPorProyecto.set([]);
    if (this.selectedEmpresaId) this.service.cargarEmpresa(this.selectedEmpresaId);
    else this.service.documentosEmpresa.set([]);
    this.solicitudesService.cargar(this.selectedEmpresaId);
  }
```

por:

```ts
  onEmpresaChange(): void {
    this.selectedCentroId = '';
    this.selectedProyectoId = '';
    this.tabJerarquia.set('empresa');
    this.tabAdminActiva.set('documentacion');
    this.tabDocAdmin.set('activos');
    this.service.documentosVencidos.set([]);
    this.service.documentosCentro.set([]);
    this.service.documentosProyecto.set([]);
    this.service.documentosPorCentro.set([]);
    this.service.documentosPorProyecto.set([]);
    if (this.selectedEmpresaId === 'todos') {
      this.service.documentosEmpresa.set([]);
      this.service.cargarTodasEmpresas();
      this.solicitudesService.solicitudes.set([]);
    } else if (this.selectedEmpresaId) {
      this.service.cargarEmpresa(this.selectedEmpresaId);
      this.solicitudesService.cargar(this.selectedEmpresaId);
    } else {
      this.service.documentosEmpresa.set([]);
      this.solicitudesService.cargar(this.selectedEmpresaId);
    }
  }
```

- [ ] **Step 4: Actualizar `onCentroChange()` para no pedir nada nuevo cuando Empresa="Todas"**

En `documentos-admin-page.component.ts:465-485`, reemplazar:

```ts
  onCentroChange(): void {
    const estabaEnVencidos = this.tabDocAdmin() === 'vencidos';
    this.selectedProyectoId = '';
    if (!estabaEnVencidos) this.tabDocAdmin.set('activos');
    this.service.documentosVencidos.set([]);
    this.service.documentosPorProyecto.set([]);
    if (this.selectedCentroId) this.tabJerarquia.set('centro');
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    if (this.selectedCentroId === 'todos') {
      this.service.documentosCentro.set([]);
      this.service.cargarTodosCentros(this.selectedEmpresaId, this.centrosFiltrados);
    } else if (centroId) {
      this.service.documentosPorCentro.set([]);
      this.service.cargar('centro', this.selectedEmpresaId, centroId);
    } else {
      this.service.documentosPorCentro.set([]);
      this.service.documentosCentro.set([]);
    }
    this.solicitudesService.cargar(this.selectedEmpresaId, centroId);
    if (estabaEnVencidos) this.cargarVencidosAdmin();
  }
```

por:

```ts
  onCentroChange(): void {
    const estabaEnVencidos = this.tabDocAdmin() === 'vencidos';
    this.selectedProyectoId = '';
    if (!estabaEnVencidos) this.tabDocAdmin.set('activos');
    this.service.documentosVencidos.set([]);
    this.service.documentosPorProyecto.set([]);
    if (this.selectedCentroId) this.tabJerarquia.set('centro');
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    if (this.selectedEmpresaId === 'todos') {
      // Los datos ya están en service.documentosTodasEmpresas(); no hace falta pedir nada.
      this.service.documentosCentro.set([]);
      this.service.documentosPorCentro.set([]);
    } else if (this.selectedCentroId === 'todos') {
      this.service.documentosCentro.set([]);
      this.service.cargarTodosCentros(this.selectedEmpresaId, this.centrosFiltrados);
    } else if (centroId) {
      this.service.documentosPorCentro.set([]);
      this.service.cargar('centro', this.selectedEmpresaId, centroId);
    } else {
      this.service.documentosPorCentro.set([]);
      this.service.documentosCentro.set([]);
    }
    if (this.selectedEmpresaId === 'todos') {
      this.solicitudesService.solicitudes.set([]);
    } else {
      this.solicitudesService.cargar(this.selectedEmpresaId, centroId);
    }
    if (estabaEnVencidos) this.cargarVencidosAdmin();
  }
```

- [ ] **Step 5: Actualizar `onProyectoChange()` con el mismo criterio**

En `documentos-admin-page.component.ts:487-513`, reemplazar:

```ts
  onProyectoChange(): void {
    const estabaEnVencidos = this.tabDocAdmin() === 'vencidos';
    if (!estabaEnVencidos) this.tabDocAdmin.set('activos');
    this.service.documentosVencidos.set([]);
    if (this.selectedProyectoId) this.tabJerarquia.set('proyecto');
    const centroId   = (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;

    this.service.documentosProyecto.set([]);
    this.service.documentosPorProyecto.set([]);

    if (this.selectedProyectoId === 'todos' && this.selectedCentroId === 'todos') {
      const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === this.selectedEmpresaId);
      this.service.cargarTodosProyectos(this.selectedEmpresaId, todos, this.centrosFiltrados);
    } else if (this.selectedProyectoId === 'todos' && centroId) {
      const delCentro = this.proyectosService.proyectos().filter(
        p => asId(p.cliente_id) === this.selectedEmpresaId && (p.centro_costo_ids ?? []).some(id => asId(id) === centroId)
      );
      this.service.cargarTodosProyectos(this.selectedEmpresaId, delCentro, this.centrosFiltrados);
    } else if (proyectoId && centroId) {
      this.service.cargar('proyecto', this.selectedEmpresaId, centroId, proyectoId);
    } else if (centroId) {
      this.service.cargar('centro', this.selectedEmpresaId, centroId);
    }
    this.solicitudesService.cargar(this.selectedEmpresaId, centroId, proyectoId);
    if (estabaEnVencidos) this.cargarVencidosAdmin();
  }
```

por:

```ts
  onProyectoChange(): void {
    const estabaEnVencidos = this.tabDocAdmin() === 'vencidos';
    if (!estabaEnVencidos) this.tabDocAdmin.set('activos');
    this.service.documentosVencidos.set([]);
    if (this.selectedProyectoId) this.tabJerarquia.set('proyecto');
    const centroId   = (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;

    this.service.documentosProyecto.set([]);
    this.service.documentosPorProyecto.set([]);

    if (this.selectedEmpresaId === 'todos') {
      // Los datos ya están en service.documentosTodasEmpresas(); no hace falta pedir nada.
    } else if (this.selectedProyectoId === 'todos' && this.selectedCentroId === 'todos') {
      const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === this.selectedEmpresaId);
      this.service.cargarTodosProyectos(this.selectedEmpresaId, todos, this.centrosFiltrados);
    } else if (this.selectedProyectoId === 'todos' && centroId) {
      const delCentro = this.proyectosService.proyectos().filter(
        p => asId(p.cliente_id) === this.selectedEmpresaId && (p.centro_costo_ids ?? []).some(id => asId(id) === centroId)
      );
      this.service.cargarTodosProyectos(this.selectedEmpresaId, delCentro, this.centrosFiltrados);
    } else if (proyectoId && centroId) {
      this.service.cargar('proyecto', this.selectedEmpresaId, centroId, proyectoId);
    } else if (centroId) {
      this.service.cargar('centro', this.selectedEmpresaId, centroId);
    }
    if (this.selectedEmpresaId === 'todos') {
      this.solicitudesService.solicitudes.set([]);
    } else {
      this.solicitudesService.cargar(this.selectedEmpresaId, centroId, proyectoId);
    }
    if (estabaEnVencidos) this.cargarVencidosAdmin();
  }
```

- [ ] **Step 6: Agregar los 3 getters de vistas agregadas**

En `documentos-admin-page.component.ts`, agregar después de `docsFiltrados` (después de su cierre, línea 696):

```ts
  docsEmpresaTodas(): { doc: DocBusquedaItem; empresaId: string; empresaNombre: string }[] {
    const { filtrosCategorias, busqueda } = this.panels['empresa'];
    const term = busqueda.trim().toLowerCase();
    const filas: { doc: DocBusquedaItem; empresaId: string; empresaNombre: string }[] = [];
    for (const empresa of this.service.documentosTodasEmpresas()) {
      for (const doc of empresa.documentos) filas.push({ doc, empresaId: empresa._id, empresaNombre: empresa.nombre });
    }
    return filas
      .filter(f => !filtrosCategorias.length || filtrosCategorias.includes(f.doc.categoria ?? ''))
      .filter(f => !term || f.doc.nombre_display.toLowerCase().includes(term));
  }

  docsCentroTodas(): { doc: DocBusquedaItem; empresaId: string; empresaNombre: string; centroId: string; centroNombre: string }[] {
    const { filtrosCategorias, busqueda } = this.panels['centro'];
    const term = busqueda.trim().toLowerCase();
    const filas: { doc: DocBusquedaItem; empresaId: string; empresaNombre: string; centroId: string; centroNombre: string }[] = [];
    for (const empresa of this.service.documentosTodasEmpresas()) {
      for (const centro of empresa.centros) {
        for (const doc of centro.documentos) {
          filas.push({ doc, empresaId: empresa._id, empresaNombre: empresa.nombre, centroId: centro._id, centroNombre: centro.nombre });
        }
      }
    }
    return filas
      .filter(f => !filtrosCategorias.length || filtrosCategorias.includes(f.doc.categoria ?? ''))
      .filter(f => !term || f.doc.nombre_display.toLowerCase().includes(term));
  }

  docsProyectoTodas(): { doc: DocBusquedaItem; empresaId: string; empresaNombre: string; centroId: string; centroNombre: string; proyectoId: string; proyectoNombre: string }[] {
    const { filtrosCategorias, busqueda } = this.panels['proyecto'];
    const term = busqueda.trim().toLowerCase();
    const filas: { doc: DocBusquedaItem; empresaId: string; empresaNombre: string; centroId: string; centroNombre: string; proyectoId: string; proyectoNombre: string }[] = [];
    for (const empresa of this.service.documentosTodasEmpresas()) {
      for (const centro of empresa.centros) {
        for (const proyecto of centro.proyectos) {
          for (const doc of proyecto.documentos) {
            filas.push({
              doc, empresaId: empresa._id, empresaNombre: empresa.nombre,
              centroId: centro._id, centroNombre: centro.nombre,
              proyectoId: proyecto._id, proyectoNombre: proyecto.nombre,
            });
          }
        }
      }
    }
    return filas
      .filter(f => !filtrosCategorias.length || filtrosCategorias.includes(f.doc.categoria ?? ''))
      .filter(f => !term || f.doc.nombre_display.toLowerCase().includes(term));
  }
```

- [ ] **Step 7: Agregar las acciones por fila (eliminar y cambiar categoría) de la vista agregada**

En `documentos-admin-page.component.ts`, agregar después de `eliminarEnTodos` (después de su cierre, línea 738):

```ts
  eliminarEnTodasEmpresas(docUrl: string, empresaId: string): void {
    this.service.eliminar(docUrl, 'empresa', empresaId, undefined, undefined,
      () => this.service.cargarTodasEmpresas());
  }

  eliminarCentroEnTodasEmpresas(docUrl: string, empresaId: string, centroId: string): void {
    this.service.eliminar(docUrl, 'centro', empresaId, centroId, undefined,
      () => this.service.cargarTodasEmpresas());
  }

  eliminarProyectoEnTodasEmpresas(docUrl: string, empresaId: string, centroId: string, proyectoId: string): void {
    this.service.eliminar(docUrl, 'proyecto', empresaId, centroId, proyectoId,
      () => this.service.cargarTodasEmpresas());
  }
```

Y agregar después de `seleccionarCategoriaTodos` (después de su cierre, línea 716):

```ts
  seleccionarCategoriaTodasEmpresas(docUrl: string, categoria: string, tipo: DocTipo): void {
    this.categoriaMenuAbierto.set(null);
    this.service.actualizarCategoria(docUrl, categoria, tipo, () => this.service.cargarTodasEmpresas());
  }
```

- [ ] **Step 8: Actualizar `cargarVencidosAdmin` para no llamar al backend con `empresa_id` inválido**

En `documentos-admin-page.component.ts:1040-1048`, reemplazar:

```ts
  cargarVencidosAdmin(): void {
    const empresaId = this.selectedEmpresaId;
    if (!empresaId) return;
    const tab = this.tabJerarquia();
    const centroId   = tab !== 'empresa' && this.selectedCentroId   && this.selectedCentroId   !== 'todos' ? this.selectedCentroId   : undefined;
    const proyectoId = tab === 'proyecto' && this.selectedProyectoId && this.selectedProyectoId !== 'todos' ? this.selectedProyectoId : undefined;
    const tipo: 'empresa' | 'centro' | 'proyecto' = tab === 'centro' || tab === 'proyecto' ? tab : 'empresa';
    this.service.cargarVencidos(empresaId, centroId, proyectoId, tipo);
  }
```

por:

```ts
  cargarVencidosAdmin(): void {
    const empresaId = this.selectedEmpresaId;
    if (!empresaId || empresaId === 'todos') { this.service.documentosVencidos.set([]); return; }
    const tab = this.tabJerarquia();
    const centroId   = tab !== 'empresa' && this.selectedCentroId   && this.selectedCentroId   !== 'todos' ? this.selectedCentroId   : undefined;
    const proyectoId = tab === 'proyecto' && this.selectedProyectoId && this.selectedProyectoId !== 'todos' ? this.selectedProyectoId : undefined;
    const tipo: 'empresa' | 'centro' | 'proyecto' = tab === 'centro' || tab === 'proyecto' ? tab : 'empresa';
    this.service.cargarVencidos(empresaId, centroId, proyectoId, tipo);
  }
```

- [ ] **Step 9: Actualizar `crearSolicitud` para no crear solicitudes con `empresa_id: 'todos'`**

En `documentos-admin-page.component.ts:809`, reemplazar la primera línea:

```ts
  crearSolicitud(): void {
    if (!this.solicitudForm.nombre || !this.selectedEmpresaId) return;
```

por:

```ts
  crearSolicitud(): void {
    if (!this.solicitudForm.nombre || !this.selectedEmpresaId || this.selectedEmpresaId === 'todos') return;
```

- [ ] **Step 10: Actualizar `confirmarVencer` para recargar la vista agregada cuando corresponde**

En `documentos-admin-page.component.ts:1097-1107`, reemplazar:

```ts
    let onSuccess: (() => void) | undefined;
    if (this.tabJerarquia() === 'todos') {
      onSuccess = () => this.refrescarBusquedaCascada();
    } else if (this.selectedCentroId === 'todos' && m.centroIdReal) {
      onSuccess = () => this.service.cargarTodosCentros(empresaId, this.centrosFiltrados);
    } else if (this.selectedProyectoId === 'todos' && m.proyectoIdReal) {
      onSuccess = () => {
        const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === empresaId);
        this.service.cargarTodosProyectos(empresaId, todos, this.centrosFiltrados);
      };
    }
```

por:

```ts
    let onSuccess: (() => void) | undefined;
    if (this.tabJerarquia() === 'todos') {
      onSuccess = () => this.refrescarBusquedaCascada();
    } else if (this.selectedEmpresaId === 'todos') {
      onSuccess = () => this.service.cargarTodasEmpresas();
    } else if (this.selectedCentroId === 'todos' && m.centroIdReal) {
      onSuccess = () => this.service.cargarTodosCentros(empresaId, this.centrosFiltrados);
    } else if (this.selectedProyectoId === 'todos' && m.proyectoIdReal) {
      onSuccess = () => {
        const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === empresaId);
        this.service.cargarTodosProyectos(empresaId, todos, this.centrosFiltrados);
      };
    }
```

- [ ] **Step 11: Compilar y verificar que no hay errores de tipo**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores.

- [ ] **Step 12: Commit**

```bash
cd front4
git add src/app/features/documentos/pages/documentos-admin-page.component.ts
git commit -m "feat(front): lógica de agregación para Empresa=Todas en Documentos (admin)"
```

---

## Task 3: Selects de Empresa y Centro — plantilla

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`

**Interfaces:**
- Consumes: `centrosFiltrados`, `clientesService.clientes()` (Task 2), `selectedEmpresaId`/`onEmpresaChange()` (ya existentes).

- [ ] **Step 1: Etiqueta del tab "Empresa" cuando está en "Todas"**

En `documentos-admin-page.component.html:96`, reemplazar:

```html
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ empresaNombre || 'Empresa' }}</span>
```

por:

```html
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ (selectedEmpresaId === 'todos' ? 'Todas las empresas' : empresaNombre) || 'Empresa' }}</span>
```

- [ ] **Step 2: Panel resumen de Empresa — agregar rama "Todas" y cambiar el select**

En `documentos-admin-page.component.html:149-184`, reemplazar el bloque completo:

```html
    @if (tabJerarquia() === 'empresa') {
      <div style="padding:1rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem">
        @if (empresaSeleccionadaObj) {
          <div style="border-left:4px solid #0095d6;border-radius:8px;background:#fafbfc;padding:.75rem .85rem;display:flex;align-items:center;gap:.75rem">
            <div style="width:38px;height:38px;border-radius:9px;background:rgba(0,149,214,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#0095d6">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
                <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
              </svg>
            </div>
            <div>
              <p style="margin:0 0 .15rem;font-size:.9rem;font-weight:700;color:#1f2937">{{ empresaNombre }}</p>
              <p style="margin:0;font-size:.75rem;color:#6b7280">
                RUT: {{ empresaSeleccionadaObj.rut }}
                @if (empresaSeleccionadaObj.direccion?.ciudad) { · {{ empresaSeleccionadaObj.direccion!.ciudad }} }
              </p>
            </div>
          </div>
        } @else {
          <div style="border-left:4px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:.75rem .85rem;display:flex;align-items:center">
            <p style="margin:0;color:#9ca3af;font-size:.875rem">Selecciona una empresa para ver su documentación.</p>
          </div>
        }
        <label class="field" style="margin:0;justify-content:center">
          <span>Empresa</span>
          <select [(ngModel)]="selectedEmpresaId" (ngModelChange)="onEmpresaChange()">
            <option value="">Todas</option>
            @for (c of clientesService.clientes(); track c._id) {
              <option [value]="c._id">{{ c.razon_social }}</option>
            }
          </select>
        </label>
      </div>
    }
```

por:

```html
    @if (tabJerarquia() === 'empresa') {
      <div style="padding:1rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem">
        @if (selectedEmpresaId === 'todos') {
          <div style="border-left:4px solid #0095d6;border-radius:8px;background:#fafbfc;padding:.75rem .85rem;display:flex;align-items:center;gap:.75rem">
            <div style="width:38px;height:38px;border-radius:9px;background:rgba(0,149,214,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#0095d6">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
                <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
              </svg>
            </div>
            <div>
              <p style="margin:0 0 .15rem;font-size:.9rem;font-weight:700;color:#1f2937">Documentación total de empresas</p>
              <p style="margin:0;font-size:.75rem;color:#6b7280">{{ clientesService.clientes().length }} empresas</p>
            </div>
          </div>
        } @else if (empresaSeleccionadaObj) {
          <div style="border-left:4px solid #0095d6;border-radius:8px;background:#fafbfc;padding:.75rem .85rem;display:flex;align-items:center;gap:.75rem">
            <div style="width:38px;height:38px;border-radius:9px;background:rgba(0,149,214,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#0095d6">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
                <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
              </svg>
            </div>
            <div>
              <p style="margin:0 0 .15rem;font-size:.9rem;font-weight:700;color:#1f2937">{{ empresaNombre }}</p>
              <p style="margin:0;font-size:.75rem;color:#6b7280">
                RUT: {{ empresaSeleccionadaObj.rut }}
                @if (empresaSeleccionadaObj.direccion?.ciudad) { · {{ empresaSeleccionadaObj.direccion!.ciudad }} }
              </p>
            </div>
          </div>
        } @else {
          <div style="border-left:4px solid #e5e7eb;border-radius:8px;background:#f9fafb;padding:.75rem .85rem;display:flex;align-items:center">
            <p style="margin:0;color:#9ca3af;font-size:.875rem">Selecciona una empresa para ver su documentación.</p>
          </div>
        }
        <label class="field" style="margin:0;justify-content:center">
          <span>Empresa</span>
          <select [(ngModel)]="selectedEmpresaId" (ngModelChange)="onEmpresaChange()">
            <option value="">Ninguna</option>
            <option value="todos">Todas</option>
            @for (c of clientesService.clientes(); track c._id) {
              <option [value]="c._id">{{ c.razon_social }}</option>
            }
          </select>
        </label>
      </div>
    }
```

- [ ] **Step 3: Ocultar los centros individuales del select de Centro cuando Empresa="Todas"**

En `documentos-admin-page.component.html:227-236`, reemplazar:

```html
        <label class="field" style="margin:0;justify-content:center">
          <span>Centro de costos</span>
          <select [(ngModel)]="selectedCentroId" (ngModelChange)="onCentroChange()" [disabled]="!selectedEmpresaId">
            <option value="">Ninguno</option>
            <option value="todos">Todos</option>
            @for (c of centrosFiltrados; track c._id) {
              <option [value]="c._id">{{ c.nombre }}</option>
            }
          </select>
        </label>
```

por:

```html
        <label class="field" style="margin:0;justify-content:center">
          <span>Centro de costos</span>
          <select [(ngModel)]="selectedCentroId" (ngModelChange)="onCentroChange()" [disabled]="!selectedEmpresaId">
            <option value="">Ninguno</option>
            <option value="todos">Todos</option>
            @if (selectedEmpresaId !== 'todos') {
              @for (c of centrosFiltrados; track c._id) {
                <option [value]="c._id">{{ c.nombre }}</option>
              }
            }
          </select>
        </label>
```

- [ ] **Step 4: Compilar y verificar visualmente**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores.

Manual: con `ng serve` corriendo, loguear como `super_admin`, ir a Documentos → tab Empresa → elegir "Todas" en el select. Verificar: el panel resumen muestra "Documentación total de empresas" con el conteo correcto, el select de Centro se habilita y su lista desplegable solo muestra "Ninguno"/"Todos" (sin centros individuales).

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front): selects de Empresa/Centro soportan Empresa=Todas en Documentos (admin)"
```

---

## Task 4: Listas agregadas (empresa / centro / proyecto) — plantilla

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`

**Interfaces:**
- Consumes: `docsEmpresaTodas()`, `docsCentroTodas()`, `docsProyectoTodas()`, `eliminarEnTodasEmpresas`, `eliminarCentroEnTodasEmpresas`, `eliminarProyectoEnTodasEmpresas`, `seleccionarCategoriaTodasEmpresas` (Task 2).

- [ ] **Step 1: Insertar la lista agregada de Empresa después del bloque `puedeGestionarDocumento`**

En `documentos-admin-page.component.html`, ubicar el cierre del bloque que empieza en la línea 502 `@if (puedeGestionarDocumento) {` — cierra en la línea 605 con `}` seguido de la línea 606 en blanco y el comentario `<!-- Vista "todos centros": filtrada -->` en la línea 607. Insertar el siguiente bloque nuevo **entre** el `}` de la línea 605 y el comentario de la línea 607:

```html
          <!-- Vista "todas las empresas": nivel empresa -->
          @if (tabJerarquia() === 'empresa' && selectedEmpresaId === 'todos') {
            @if (docsEmpresaTodas().length === 0) {
              <p class="empty">Sin documentos.</p>
            } @else {
              <div style="border:1px solid #e5e7eb;border-radius:8px">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (fila of docsEmpresaTodas(); track fila.doc._id) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ fila.doc.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ fila.doc.nombre_display }}</span>
                          @if (fila.doc.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa · {{ fila.empresaNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(fila.doc.subido_en) }}</span>
                          @if (fila.doc.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ fila.doc.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.35rem;flex-shrink:0">
                      <button (click)="abrirDocumento(fila.doc)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        @if (fila.doc.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                        {{ fila.doc.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                      </button>
                      <div style="position:relative">
                        <button title="Cambiar categoría" (click)="toggleCategoriaMenu(fila.doc._id)"
                                style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                        </button>
                        @if (categoriaMenuAbierto() === fila.doc._id) {
                          <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                          <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                            @for (cat of categorias; track cat) {
                              <div (click)="seleccionarCategoriaTodasEmpresas(fila.doc.url, cat, 'empresa')"
                                   style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                   [style.font-weight]="cat === fila.doc.categoria ? '700' : '400'"
                                   [style.color]="cat === fila.doc.categoria ? '#3730a3' : '#374151'"
                                   [style.background]="cat === fila.doc.categoria ? '#eef2ff' : 'transparent'">
                                {{ cat }}
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (puedeVencer()) {
                      <button (click)="abrirModalVencer(fila.doc, undefined, undefined, fila.empresaId, 'empresa')"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Marcar vencido
                      </button>
                      }
                      <button (click)="eliminarEnTodasEmpresas(fila.doc.url, fila.empresaId)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          }

```

- [ ] **Step 2: Evitar que la vista "todos centros" de una sola empresa se muestre también con Empresa="Todas", e insertar la lista agregada de Centro**

En `documentos-admin-page.component.html:608`, reemplazar:

```html
          <!-- Vista "todos centros": filtrada -->
          @if (tabJerarquia() === 'centro' && selectedCentroId === 'todos') {
```

por:

```html
          <!-- Vista "todos centros": filtrada (una sola empresa) -->
          @if (tabJerarquia() === 'centro' && selectedCentroId === 'todos' && selectedEmpresaId !== 'todos') {
```

Luego, ubicar el cierre de ese bloque (línea 689, `}`) seguido de la línea en blanco y el comentario `<!-- Vista "todos proyectos": filtrada -->` (línea 691). Insertar el siguiente bloque nuevo **entre** el `}` de la línea 689 y ese comentario:

```html
          <!-- Vista "todos los centros de todas las empresas" -->
          @if (tabJerarquia() === 'centro' && selectedCentroId === 'todos' && selectedEmpresaId === 'todos') {
            @if (docsCentroTodas().length === 0) {
              <p class="empty">Sin documentos en centros de costos.</p>
            } @else {
              <div style="border:1px solid #e5e7eb;border-radius:8px">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (fila of docsCentroTodas(); track fila.doc._id) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ fila.doc.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ fila.doc.nombre_display }}</span>
                          @if (fila.doc.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa · {{ fila.empresaNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro · {{ fila.centroNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(fila.doc.subido_en) }}</span>
                          @if (fila.doc.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ fila.doc.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.3rem;flex-shrink:0">
                      <button (click)="abrirDocumento(fila.doc)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        @if (fila.doc.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                        {{ fila.doc.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                      </button>
                      <div style="position:relative">
                        <button title="Cambiar categoría" (click)="toggleCategoriaMenu(fila.doc._id)"
                                style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                        </button>
                        @if (categoriaMenuAbierto() === fila.doc._id) {
                          <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                          <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                            @for (cat of categorias; track cat) {
                              <div (click)="seleccionarCategoriaTodasEmpresas(fila.doc.url, cat, 'centro')"
                                   style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                   [style.font-weight]="cat === fila.doc.categoria ? '700' : '400'"
                                   [style.color]="cat === fila.doc.categoria ? '#3730a3' : '#374151'"
                                   [style.background]="cat === fila.doc.categoria ? '#eef2ff' : 'transparent'">
                                {{ cat }}
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (puedeVencer()) {
                      <button (click)="abrirModalVencer(fila.doc, fila.centroId, undefined, fila.empresaId, 'centro')"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Marcar vencido
                      </button>
                      }
                      <button (click)="eliminarCentroEnTodasEmpresas(fila.doc.url, fila.empresaId, fila.centroId)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          }

```

- [ ] **Step 3: Evitar que la vista "todos proyectos" de una sola empresa se muestre también con Empresa="Todas", e insertar la lista agregada de Proyecto**

En `documentos-admin-page.component.html:692`, reemplazar:

```html
          <!-- Vista "todos proyectos": filtrada -->
          @if (tabJerarquia() === 'proyecto' && selectedProyectoId === 'todos') {
```

por:

```html
          <!-- Vista "todos proyectos": filtrada (una sola empresa) -->
          @if (tabJerarquia() === 'proyecto' && selectedProyectoId === 'todos' && selectedEmpresaId !== 'todos') {
```

Luego, ubicar el cierre de ese bloque (línea 776, `}`) seguido de la línea en blanco y `} <!-- fin activos -->` (línea 778). Insertar el siguiente bloque nuevo **entre** el `}` de la línea 776 y `} <!-- fin activos -->`:

```html
          <!-- Vista "todos los proyectos de todas las empresas" -->
          @if (tabJerarquia() === 'proyecto' && selectedProyectoId === 'todos' && selectedEmpresaId === 'todos') {
            @if (docsProyectoTodas().length === 0) {
              <p class="empty">Sin documentos en proyectos.</p>
            } @else {
              <div style="border:1px solid #e5e7eb;border-radius:8px">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (fila of docsProyectoTodas(); track fila.doc._id) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ fila.doc.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ fila.doc.nombre_display }}</span>
                          @if (fila.doc.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa · {{ fila.empresaNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro · {{ fila.centroNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto · {{ fila.proyectoNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(fila.doc.subido_en) }}</span>
                          @if (fila.doc.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ fila.doc.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.3rem;flex-shrink:0">
                      <button (click)="abrirDocumento(fila.doc)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        @if (fila.doc.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                        {{ fila.doc.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                      </button>
                      <div style="position:relative">
                        <button title="Cambiar categoría" (click)="toggleCategoriaMenu(fila.doc._id)"
                                style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                        </button>
                        @if (categoriaMenuAbierto() === fila.doc._id) {
                          <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                          <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                            @for (cat of categorias; track cat) {
                              <div (click)="seleccionarCategoriaTodasEmpresas(fila.doc.url, cat, 'proyecto')"
                                   style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                   [style.font-weight]="cat === fila.doc.categoria ? '700' : '400'"
                                   [style.color]="cat === fila.doc.categoria ? '#3730a3' : '#374151'"
                                   [style.background]="cat === fila.doc.categoria ? '#eef2ff' : 'transparent'">
                                {{ cat }}
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (puedeVencer()) {
                      <button (click)="abrirModalVencer(fila.doc, fila.centroId, fila.proyectoId, fila.empresaId, 'proyecto')"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Marcar vencido
                      </button>
                      }
                      <button (click)="eliminarProyectoEnTodasEmpresas(fila.doc.url, fila.empresaId, fila.centroId, fila.proyectoId)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          }

```

- [ ] **Step 4: Compilar y verificar visualmente**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores.

Manual: con Empresa="Todas" elegida:
- Tab Empresa: se ve la lista plana de documentos a nivel empresa de todas las empresas, cada fila con badge "Empresa · {{nombre real}}".
- Tab Centro → Centro="Todos": se ve la lista plana de documentos de todos los centros de todas las empresas, cada fila con badges "Empresa · X" y "Centro · Y".
- Tab Proyecto → Centro="Todos" → Proyecto="Todos": se ve la lista plana de todos los proyectos de todas las empresas, cada fila con badges "Empresa · X", "Centro · Y" y "Proyecto · Z".
- Descargar, cambiar categoría, marcar vencido y eliminar funcionan sobre una fila puntual sin romper el resto de la lista.
- El botón "Subir" no aparece en ninguna de estas 3 vistas.

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front): listas agregadas de documentos para Empresa=Todas en Documentos (admin)"
```

---

## Task 5: Guards de Solicitudes y Vencidos con Empresa="Todas"

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`

- [ ] **Step 1: Deshabilitar el botón "Vencidos" y el botón "Nueva solicitud" con Empresa="Todas"**

En `documentos-admin-page.component.html:371-376`, reemplazar:

```html
                <button
                  style="flex:1;padding:.3rem .5rem;border-style:solid;border-width:1px;border-radius:6px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:.35rem"
                  [style.background]="tabDocAdmin() === 'vencidos' ? 'rgba(239,68,68,.06)' : 'transparent'"
                  [style.color]="tabDocAdmin() === 'vencidos' ? '#dc2626' : '#6b7280'"
                  [style.borderColor]="tabDocAdmin() === 'vencidos' ? 'rgba(239,68,68,.25)' : '#e5e7eb'"
                  (click)="activarTabVencidosAdmin()">
```

por:

```html
                <button
                  style="flex:1;padding:.3rem .5rem;border-style:solid;border-width:1px;border-radius:6px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:.35rem"
                  [style.background]="tabDocAdmin() === 'vencidos' ? 'rgba(239,68,68,.06)' : 'transparent'"
                  [style.color]="tabDocAdmin() === 'vencidos' ? '#dc2626' : '#6b7280'"
                  [style.borderColor]="tabDocAdmin() === 'vencidos' ? 'rgba(239,68,68,.25)' : '#e5e7eb'"
                  [style.opacity]="selectedEmpresaId === 'todos' ? '0.45' : '1'"
                  [disabled]="selectedEmpresaId === 'todos'"
                  (click)="activarTabVencidosAdmin()">
```

En `documentos-admin-page.component.html:385`, reemplazar:

```html
              @if (tabAdminActiva() === 'solicitudes') {
                <button class="btn-success" style="width:100%;font-size:.8rem;padding:.4rem .9rem;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:.35rem" (click)="abrirSolicitudForm()">
```

por:

```html
              @if (tabAdminActiva() === 'solicitudes' && selectedEmpresaId !== 'todos') {
                <button class="btn-success" style="width:100%;font-size:.8rem;padding:.4rem .9rem;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:.35rem" (click)="abrirSolicitudForm()">
```

- [ ] **Step 2: Mensaje en la sub-vista Vencidos cuando Empresa="Todas"**

En `documentos-admin-page.component.html`, esta sub-vista abre en la línea 781 y cierra en la línea 838 con el comentario `<!-- fin vencidos -->` (único en el archivo — confirmarlo con `grep -n "fin vencidos" documentos-admin-page.component.html` antes de editar). Se edita en dos puntos: la apertura (Edit A) y el cierre (Edit B), sin tocar el contenido intermedio de la tabla.

**Edit A** — reemplazar:

```html
          @if (tabDocAdmin() === 'vencidos') {
            <p style="margin:0 0 .75rem;font-size:.8rem;color:#6b7280">Mostrando los últimos 20 documentos vencidos de este contexto.</p>
```

por:

```html
          @if (tabDocAdmin() === 'vencidos') {
            @if (selectedEmpresaId === 'todos') {
              <p class="empty">Selecciona una empresa específica para ver sus documentos vencidos.</p>
            } @else {
            <p style="margin:0 0 .75rem;font-size:.8rem;color:#6b7280">Mostrando los últimos 20 documentos vencidos de este contexto.</p>
```

**Edit B** — reemplazar:

```html
            }
          } <!-- fin vencidos -->
```

por:

```html
            }
          }
          } <!-- fin vencidos -->
```

(el `}` extra cierra el `@else` agregado en el Edit A).

- [ ] **Step 3: Mensaje en la lista de Solicitudes cuando Empresa="Todas"**

En `documentos-admin-page.component.html`, este bloque abre después de `<app-status-banner [status]="solicitudesService.status()"></app-status-banner>` en la línea 965 y cierra en la línea 1085 con el comentario `<!-- fin solicitudes -->` (único en el archivo — confirmarlo con `grep -n "fin solicitudes" documentos-admin-page.component.html` antes de editar). Igual que en el Step 2, se edita apertura y cierre por separado.

**Edit A** — reemplazar:

```html
          <app-status-banner [status]="solicitudesService.status()"></app-status-banner>

          @let sols = solicitudesEnSolicitudes();
```

por:

```html
          <app-status-banner [status]="solicitudesService.status()"></app-status-banner>

          @if (selectedEmpresaId === 'todos') {
            <p class="empty">Selecciona una empresa específica para ver sus solicitudes.</p>
          } @else {

          @let sols = solicitudesEnSolicitudes();
```

**Edit B** — reemplazar:

```html
            </div>
          }

        } <!-- fin solicitudes -->
```

por:

```html
            </div>
          }
          }

        } <!-- fin solicitudes -->
```

(el `}` extra cierra el `@else` agregado en el Edit A).

- [ ] **Step 4: Compilar y verificar visualmente**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores. Si Angular reporta un `@if`/`@else` sin cerrar, revisar que el `}` extra de los Steps 2 y 3 quedó en el lugar correcto (mismo nivel que el `}` que ya cerraba el bloque original).

Manual: con Empresa="Todas" elegida — el botón "Vencidos" se ve deshabilitado (opacado) y no reacciona al click; al entrar a la pestaña "Solicitudes" se ve el mensaje "Selecciona una empresa específica..." y no aparece el botón "Nueva solicitud".

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front): deshabilitar Vencidos/Solicitudes con Empresa=Todas en Documentos (admin)"
```

---

## Task 6: Verificación final end-to-end

**Files:** ninguno (solo verificación manual).

- [ ] **Step 1: Suite completa de tests**

Run: `cd front4 && npx ng test --watch=false`
Expected: mismos resultados que antes de empezar (el único test que fallaba, `app.spec.ts > should render title`, es preexistente y no relacionado — no debe haber *nuevas* fallas).

- [ ] **Step 2: Compilación completa**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores.

- [ ] **Step 3: Recorrido manual completo (super_admin, con `ng serve`/`nest start:dev` corriendo)**

En Documentos (admin), probar las 4 combinaciones del spec:
1. Empresa=X (específica), Centro=Todos → centros de X (sin cambios respecto a antes).
2. Empresa=Todas, sin elegir Centro → documentos a nivel empresa de todas las empresas.
3. Empresa=Todas, Centro=Todos → todos los centros de todas las empresas.
4. Empresa=Todas, Centro=Todos, Proyecto=Todos → todos los proyectos de todas las empresas.

En cada una de 2-4: confirmar que no aparece "Subir", que Eliminar/Marcar vencido/Cambiar categoría funcionan sobre una fila puntual, y que Vencidos/Solicitudes muestran el mensaje de "elige una empresa específica".

- [ ] **Step 4: Confirmar con el usuario**

No cerrar la tarea como completa sin que el usuario confirme el recorrido manual — reportar qué se verificó y qué falta.
