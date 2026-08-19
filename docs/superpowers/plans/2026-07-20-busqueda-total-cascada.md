# Búsqueda Total Cascada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un árbol de "búsqueda total cascada" a la Tarjeta A de la página Documentos (admin) que, por nivel (empresa/centro/proyecto), liste documentos de **todas** las empresas del sistema filtrados por el panel de categoría/nombre ya existente, y permita fijar el contexto activo con un clic.

**Architecture:** Backend: nuevo módulo standalone `documentos-busqueda` (sin schema propio) que agrega `doc_cliente`/`doc_centro_costo`/`doc_proyecto` de todas las empresas en un único árbol de 3 niveles y lo reshapea/aplana según el `nivel` pedido. Frontend: `DocumentosService` expone el árbol vía signal; `DocumentosAdminPageComponent` divide la Tarjeta A en 2 columnas (selector existente + árbol nuevo) y reutiliza el estado de filtro (`panels[docTipoActual]`) y los handlers de contexto (`onEmpresaChange`/`onCentroChange`/`onProyectoChange`) ya existentes.

**Tech Stack:** NestJS 10 + Mongoose 8 (back4), Angular 21 standalone + signals + Vitest (front4).

## Global Constraints

- Sin `any` en código de producción, salvo el patrón ya establecido para modelos Mongoose "foráneos" a un módulo (ver `documentos-vencidos.service.ts`, que usa `Model<any>` para `Usuario`).
- Siempre `.lean()` en queries de lectura; sin populate pesado.
- `class-validator`/DTOs no son obligatorios para query params simples de un solo `@Get()` (ver `documentos-vencidos.controller.ts`, que usa `@Query()` directo) — se sigue ese mismo patrón, sin DTO nuevo.
- Guard: `@Roles('super_admin', 'admin_smartclarity')` — sin restricción por `empresaId` (cross-empresa intencional).
- Frontend: componentes standalone, signals, control flow moderno (`@for`/`@if`), `ngModel` (FormsModule), sin `any`, estilos inline (consistente con el resto de `documentos-admin-page.component.html`).
- No agregar paginación, caja de texto dedicada, ni acciones de gestión (eliminar/vencer) al árbol — fuera de alcance por diseño (ver spec).

---

## Task 1: Backend — módulo `documentos-busqueda`

**Files:**
- Create: `back4/src/documentos-busqueda/documentos-busqueda.service.ts`
- Create: `back4/src/documentos-busqueda/documentos-busqueda.controller.ts`
- Create: `back4/src/documentos-busqueda/documentos-busqueda.module.ts`
- Modify: `back4/src/app.module.ts`
- Create: `back4/scripts/test-busqueda-cascada.ts`
- Modify: `back4/package.json`

**Interfaces:**
- Produces: `NodoBusqueda` (`_id`, `nombre`, `nivel: 'empresa'|'centro'|'proyecto'`, `empresa_id`, `empresa_nombre`, `centro_id?`, `centro_nombre?`, `documentos: DocBusquedaItem[]`, `centros: NodoBusqueda[]`, `proyectos: NodoBusqueda[]`) y `DocBusquedaItem` (`_id`, `nombre_display`, `categoria?`, `tipo_mime?`, `tamano_bytes?`, `subido_en?`, `subido_por_nombre?`, `tipo_contenido?`, `link_url?`), exportados desde `documentos-busqueda.service.ts`. `DocumentosBusquedaService.buscar(nivel, categorias?, nombre?): Promise<NodoBusqueda[]>` es el método que consume el controller (Task 1) y, indirectamente, el frontend (Task 2) vía `GET /documentos/busqueda-total`.

- [ ] **Step 1: Escribir el script de prueba e2e (fallará porque el módulo no existe)**

Crear `back4/scripts/test-busqueda-cascada.ts`:

```ts
// Prueba end-to-end del endpoint de búsqueda total cascada.
// npm run test:busqueda-cascada   (usa ts-node por la metadata de decoradores de Nest)
//
// - Corre contra una base de datos TEMPORAL (portal4_test_busqueda_cascada) derivada
//   del MONGODB_URI del .env; se borra al final. No toca datos reales.
// - Siembra 2 empresas con centros/proyectos/documentos en los 3 niveles y llama
//   directo a DocumentosBusquedaService.buscar(), sin pasar por HTTP.
import 'dotenv/config';

const TEST_DB = 'portal4_test_busqueda_cascada';

function uriConDb(uri: string, db: string): string {
  try {
    const u = new URL(uri);
    u.pathname = `/${db}`;
    return u.toString();
  } catch {
    const [main, query] = uri.split('?');
    const sinDb = main.replace(/\/[^/]*$/, '');
    return `${sinDb}/${db}${query ? `?${query}` : ''}`;
  }
}

async function main() {
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';
  process.env.MONGODB_URI = uriConDb(baseUri, TEST_DB);
  console.log(`Base de datos de prueba: ${TEST_DB}`);

  const { NestFactory } = await import('@nestjs/core');
  const { Types } = await import('mongoose');
  const { getConnectionToken } = await import('@nestjs/mongoose');
  const { AppModule } = await import('../src/app.module');
  const { DocumentosBusquedaService } = await import('../src/documentos-busqueda/documentos-busqueda.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const conn: any = app.get(getConnectionToken());
  const db = conn.db;

  const oid = () => new Types.ObjectId();

  // ── Siembra ─────────────────────────────────────────────────────────────
  const empresaA = oid();
  const empresaB = oid();
  const empresaC = oid(); // inactiva: no debe aparecer nunca
  await db.collection('clientes').insertMany([
    { _id: empresaA, razon_social: 'Empresa Acme', activo: true },
    { _id: empresaB, razon_social: 'Empresa Beta', activo: true },
    { _id: empresaC, razon_social: 'Empresa Inactiva', activo: false },
  ]);

  const centroNorte = oid();
  const centroSur = oid();
  const centroPoniente = oid();
  await db.collection('centros_costos').insertMany([
    { _id: centroNorte, nombre: 'Centro Norte', cliente_id: empresaA, activo: true },
    { _id: centroSur, nombre: 'Centro Sur', cliente_id: empresaA, activo: true },
    { _id: centroPoniente, nombre: 'Centro Poniente', cliente_id: empresaB, activo: true },
  ]);

  const proyectoCableado = oid();
  const proyectoRedes = oid();
  const proyectoAire = oid();
  await db.collection('proyectos').insertMany([
    { _id: proyectoCableado, nombre: 'Proyecto Cableado', codigo: 'P1', cliente_id: empresaA, centro_costo_ids: [centroNorte] },
    { _id: proyectoRedes, nombre: 'Proyecto Redes', codigo: 'P2', cliente_id: empresaA, centro_costo_ids: [centroNorte] },
    { _id: proyectoAire, nombre: 'Proyecto Aire', codigo: 'P3', cliente_id: empresaB, centro_costo_ids: [centroPoniente] },
  ]);

  const usuarioId = oid();
  await db.collection('usuarios').insertOne({
    _id: usuarioId, nombre: 'Ana Subidora', email: 'ana@example.com', password_hash: 'x', rol: 'usuario', activo: true,
  });

  await db.collection('doc_cliente').insertMany([
    { _id: oid(), cliente_id: empresaA, nombre: 'contrato-marco-a', nombre_display: 'Contrato Marco A', categoria: 'Contrato', tipo_contenido: 'archivo', tipo_mime: 'application/pdf', subido_en: new Date(), subido_por: usuarioId },
    { _id: oid(), cliente_id: empresaB, nombre: 'factura-b', nombre_display: 'Factura B', categoria: 'Factura', tipo_contenido: 'archivo', tipo_mime: 'application/pdf', subido_en: new Date() },
  ]);
  await db.collection('doc_centro_costo').insertMany([
    { _id: oid(), centro_costo_id: centroNorte, nombre: 'contrato-centro-norte', nombre_display: 'Contrato Centro Norte', categoria: 'Contrato', tipo_contenido: 'archivo', tipo_mime: 'application/pdf', subido_en: new Date() },
    { _id: oid(), centro_costo_id: centroPoniente, nombre: 'factura-poniente', nombre_display: 'Factura Poniente', categoria: 'Factura', tipo_contenido: 'archivo', tipo_mime: 'application/pdf', subido_en: new Date() },
  ]);
  await db.collection('doc_proyecto').insertMany([
    { _id: oid(), proyecto_id: proyectoCableado, nombre: 'contrato-cableado', nombre_display: 'Contrato Cableado', categoria: 'Contrato', tipo_contenido: 'archivo', tipo_mime: 'application/pdf', subido_en: new Date() },
    { _id: oid(), proyecto_id: proyectoRedes, nombre: 'factura-redes', nombre_display: 'Factura Redes', categoria: 'Factura', tipo_contenido: 'archivo', tipo_mime: 'application/pdf', subido_en: new Date() },
    // Proyecto Aire: sin documentos.
  ]);

  const service: any = app.get(DocumentosBusquedaService);

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  // ── nivel=empresa, sin filtro ──────────────────────────────────────────
  const arbolCompleto = await service.buscar('empresa');
  console.log('\nnivel=empresa (sin filtro):', JSON.stringify(arbolCompleto.map((e: any) => e.nombre)));
  check(arbolCompleto.length === 2, `solo empresas activas (2), sin la inactiva (${arbolCompleto.length})`);
  const acme = arbolCompleto.find((e: any) => e.nombre === 'Empresa Acme');
  check(!!acme && acme.centros.length === 2, 'Empresa Acme tiene sus 2 centros (Norte y Sur) sin filtro activo');
  check(!!acme && acme.centros.some((c: any) => c.nombre === 'Centro Sur' && c.proyectos.length === 0 && c.documentos.length === 0),
    'Centro Sur aparece igual, vacío, cuando no hay filtro');

  // ── nivel=empresa, categorias=[Contrato] ───────────────────────────────
  const arbolContrato = await service.buscar('empresa', ['Contrato']);
  console.log('\nnivel=empresa (categoria=Contrato):', JSON.stringify(arbolContrato.map((e: any) => e.nombre)));
  check(arbolContrato.length === 1 && arbolContrato[0].nombre === 'Empresa Acme',
    'con filtro Contrato, Empresa Beta se poda completamente (solo tenía Factura)');
  const acmeFiltrado = arbolContrato[0];
  check(acmeFiltrado.centros.length === 1 && acmeFiltrado.centros[0].nombre === 'Centro Norte',
    'Centro Sur se poda (sin Contrato ni hijos con Contrato)');
  check(acmeFiltrado.centros[0].proyectos.length === 1 && acmeFiltrado.centros[0].proyectos[0].nombre === 'Proyecto Cableado',
    'Proyecto Redes se poda (es Factura, no Contrato); queda solo Proyecto Cableado');
  check(acmeFiltrado.documentos.length === 1 && acmeFiltrado.documentos[0].nombre_display === 'Contrato Marco A',
    'el documento propio de la empresa (nivel raíz) también respeta el filtro');
  check(acmeFiltrado.documentos[0].subido_por_nombre === 'Ana Subidora',
    'subido_por_nombre se resuelve igual que en el resto del sistema');

  // ── nivel=centro ────────────────────────────────────────────────────────
  const centrosTodos = await service.buscar('centro');
  check(centrosTodos.length === 3, `nivel=centro sin filtro trae los 3 centros de ambas empresas (${centrosTodos.length})`);
  const centrosContrato = await service.buscar('centro', ['Contrato']);
  check(centrosContrato.length === 1 && centrosContrato[0].nombre === 'Centro Norte',
    'nivel=centro con filtro Contrato: solo Centro Norte sobrevive (Sur vacío, Poniente solo Factura)');
  check(centrosContrato[0].empresa_nombre === 'Empresa Acme' && centrosContrato[0].proyectos.length === 1,
    'el nodo centro trae su breadcrumb de empresa y sus proyectos filtrados');

  // ── nivel=proyecto ──────────────────────────────────────────────────────
  const proyectosContrato = await service.buscar('proyecto', ['Contrato']);
  check(proyectosContrato.length === 1 && proyectosContrato[0].nombre === 'Proyecto Cableado',
    'nivel=proyecto con filtro Contrato: solo Proyecto Cableado, de todas las empresas');
  check(proyectosContrato[0].empresa_nombre === 'Empresa Acme' && proyectosContrato[0].centro_nombre === 'Centro Norte',
    'el nodo proyecto trae breadcrumb completo de empresa y centro');

  // ── filtro por nombre ───────────────────────────────────────────────────
  const porNombre = await service.buscar('proyecto', undefined, 'cableado');
  check(porNombre.length === 1 && porNombre[0].nombre === 'Proyecto Cableado',
    'filtro por nombre (substring, case-insensitive) también poda por documento');

  // ── Limpieza ────────────────────────────────────────────────────────────
  await db.dropDatabase();
  await app.close();
  console.log(`\nBase ${TEST_DB} eliminada.`);

  if (fallas > 0) {
    console.error(`\n${fallas} verificación(es) fallaron.`);
    process.exit(1);
  }
  console.log('Todas las verificaciones pasaron ✅');
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Agregar el script a `package.json`**

En `back4/package.json`, dentro de `"scripts"`, agregar (junto a `test:recordatorios`):

```json
"test:busqueda-cascada": "npx -y ts-node scripts/test-busqueda-cascada.ts"
```

- [ ] **Step 3: Correr el script y verificar que falla**

Run: `cd back4 && npm run test:busqueda-cascada`
Expected: FAIL — error de import, algo como `Cannot find module '../src/documentos-busqueda/documentos-busqueda.service'`.

- [ ] **Step 4: Implementar `documentos-busqueda.service.ts`**

Crear `back4/src/documentos-busqueda/documentos-busqueda.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { resolverSubidoPorNombre } from '../common/helpers/documentos.helper';

export type NivelBusqueda = 'empresa' | 'centro' | 'proyecto';

export interface DocBusquedaItem {
  _id: string;
  nombre_display: string;
  categoria?: string;
  tipo_mime?: string;
  tamano_bytes?: number;
  subido_en?: Date;
  subido_por_nombre?: string;
  tipo_contenido?: string;
  link_url?: string;
}

export interface NodoBusqueda {
  _id: string;
  nombre: string;
  nivel: NivelBusqueda;
  empresa_id: string;
  empresa_nombre: string;
  centro_id?: string;
  centro_nombre?: string;
  documentos: DocBusquedaItem[];
  centros: NodoBusqueda[];
  proyectos: NodoBusqueda[];
}

function mapDoc(d: Record<string, any>): DocBusquedaItem {
  return {
    _id: String(d._id),
    nombre_display: d.nombre_display,
    categoria: d.categoria,
    tipo_mime: d.tipo_mime,
    tamano_bytes: d.tamano_bytes,
    subido_en: d.subido_en,
    subido_por_nombre: d.subido_por_nombre,
    tipo_contenido: d.tipo_contenido,
    link_url: d.link_url,
  };
}

function groupBy<T extends Record<string, any>>(arr: T[], key: string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of arr) {
    const k = String(item[key]);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(item);
  }
  return m;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class DocumentosBusquedaService {
  constructor(
    @InjectModel('Cliente')        private readonly clienteModel: Model<any>,
    @InjectModel('CentroCosto')    private readonly centroModel: Model<any>,
    @InjectModel('Proyecto')       private readonly proyectoModel: Model<any>,
    @InjectModel('DocCliente')     private readonly docClienteModel: Model<any>,
    @InjectModel('DocCentroCosto') private readonly docCentroModel: Model<any>,
    @InjectModel('DocProyecto')    private readonly docProyectoModel: Model<any>,
    @InjectModel('Usuario')        private readonly usuarioModel: Model<any>,
  ) {}

  async buscar(nivel: NivelBusqueda, categorias?: string[], nombre?: string): Promise<NodoBusqueda[]> {
    const arbol = await this.construirArbol(categorias, nombre);
    if (nivel === 'empresa') return arbol;
    const todosCentros = arbol.flatMap(e => e.centros);
    if (nivel === 'centro') return todosCentros;
    return todosCentros.flatMap(c => c.proyectos);
  }

  private async construirArbol(categorias?: string[], nombre?: string): Promise<NodoBusqueda[]> {
    const filtroDocs: Record<string, unknown> = {};
    if (categorias?.length) filtroDocs['categoria'] = { $in: categorias };
    if (nombre?.trim())     filtroDocs['nombre_display'] = { $regex: escapeRegExp(nombre.trim()), $options: 'i' };
    const hayFiltro = !!(categorias?.length || nombre?.trim());

    const [clientes, centros, proyectos, docsEmpresaRaw, docsCentroRaw, docsProyectoRaw] = await Promise.all([
      this.clienteModel.find({ activo: true }).select('razon_social').lean(),
      this.centroModel.find({ activo: true }).select('nombre cliente_id').lean(),
      this.proyectoModel.find({}).select('nombre cliente_id centro_costo_ids').lean(),
      this.docClienteModel.find(filtroDocs).select('-contenido').lean(),
      this.docCentroModel.find(filtroDocs).select('-contenido').lean(),
      this.docProyectoModel.find(filtroDocs).select('-contenido').lean(),
    ]);

    const [docsEmpresa, docsCentro, docsProyecto] = await Promise.all([
      resolverSubidoPorNombre(docsEmpresaRaw, this.usuarioModel),
      resolverSubidoPorNombre(docsCentroRaw, this.usuarioModel),
      resolverSubidoPorNombre(docsProyectoRaw, this.usuarioModel),
    ]);

    const clienteNombre    = new Map(clientes.map((c: any) => [String(c._id), c.razon_social]));
    const docsPorEmpresa   = groupBy(docsEmpresa as any[], 'cliente_id');
    const docsPorCentro    = groupBy(docsCentro as any[], 'centro_costo_id');
    const docsPorProyecto  = groupBy(docsProyecto as any[], 'proyecto_id');

    const nodos: NodoBusqueda[] = [];
    for (const emp of clientes as any[]) {
      const empresaId = String(emp._id);
      const centrosDeEmpresa = (centros as any[]).filter(c => String(c.cliente_id) === empresaId);
      const nodosCentro: NodoBusqueda[] = [];

      for (const c of centrosDeEmpresa) {
        const centroId = String(c._id);
        const proyectosDelCentro = (proyectos as any[]).filter(
          p => (p.centro_costo_ids ?? []).some((id: any) => String(id) === centroId),
        );
        const nodosProyecto: NodoBusqueda[] = [];

        for (const p of proyectosDelCentro) {
          const docsP = (docsPorProyecto.get(String(p._id)) ?? []).map(mapDoc);
          if (hayFiltro && docsP.length === 0) continue;
          nodosProyecto.push({
            _id: String(p._id), nombre: p.nombre, nivel: 'proyecto',
            empresa_id: empresaId, empresa_nombre: emp.razon_social,
            centro_id: centroId, centro_nombre: c.nombre,
            documentos: docsP, centros: [], proyectos: [],
          });
        }

        const docsC = (docsPorCentro.get(centroId) ?? []).map(mapDoc);
        if (hayFiltro && docsC.length === 0 && nodosProyecto.length === 0) continue;
        nodosCentro.push({
          _id: centroId, nombre: c.nombre, nivel: 'centro',
          empresa_id: empresaId, empresa_nombre: emp.razon_social,
          documentos: docsC, centros: [], proyectos: nodosProyecto,
        });
      }

      const docsE = (docsPorEmpresa.get(empresaId) ?? []).map(mapDoc);
      if (hayFiltro && docsE.length === 0 && nodosCentro.length === 0) continue;
      nodos.push({
        _id: empresaId, nombre: emp.razon_social, nivel: 'empresa',
        empresa_id: empresaId, empresa_nombre: emp.razon_social,
        documentos: docsE, centros: nodosCentro, proyectos: [],
      });
    }
    return nodos;
  }
}
```

- [ ] **Step 5: Implementar `documentos-busqueda.controller.ts`**

Crear `back4/src/documentos-busqueda/documentos-busqueda.controller.ts`:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/guards/guards';
import { DocumentosBusquedaService, NivelBusqueda } from './documentos-busqueda.service';

@Controller('documentos/busqueda-total')
export class DocumentosBusquedaController {
  constructor(private readonly service: DocumentosBusquedaService) {}

  @Get()
  @Roles('super_admin', 'admin_smartclarity')
  buscar(
    @Query('nivel') nivel?: string,
    @Query('categorias') categorias?: string,
    @Query('nombre') nombre?: string,
  ) {
    const nivelValido: NivelBusqueda = nivel === 'centro' || nivel === 'proyecto' ? nivel : 'empresa';
    const listaCategorias = categorias
      ? categorias.split(',').map(c => c.trim()).filter(Boolean)
      : undefined;
    return this.service.buscar(nivelValido, listaCategorias, nombre);
  }
}
```

- [ ] **Step 6: Implementar `documentos-busqueda.module.ts`**

Crear `back4/src/documentos-busqueda/documentos-busqueda.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentosBusquedaController } from './documentos-busqueda.controller';
import { DocumentosBusquedaService } from './documentos-busqueda.service';
import { ClienteSchema } from '../clientes/clientes.schema';
import { DocClienteSchema } from '../clientes/doc-cliente.schema';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { DocCentroCostoSchema } from '../centros-costos/doc-centro-costo.schema';
import { ProyectoSchema } from '../proyectos/proyectos.schema';
import { DocProyectoSchema } from '../proyectos/doc-proyecto.schema';
import { UsuarioSchema } from '../usuarios/usuarios.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Cliente', schema: ClienteSchema },
      { name: 'DocCliente', schema: DocClienteSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'DocCentroCosto', schema: DocCentroCostoSchema },
      { name: 'Proyecto', schema: ProyectoSchema },
      { name: 'DocProyecto', schema: DocProyectoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
  ],
  controllers: [DocumentosBusquedaController],
  providers: [DocumentosBusquedaService],
})
export class DocumentosBusquedaModule {}
```

- [ ] **Step 7: Registrar el módulo en `app.module.ts`**

Modificar `back4/src/app.module.ts`: agregar el import junto a los demás (línea 20, junto a `DocumentosVencidosModule`):

```ts
import { DocumentosBusquedaModule } from './documentos-busqueda/documentos-busqueda.module';
```

Y agregarlo al array `imports` (línea 41, justo después de `DocumentosVencidosModule,`):

```ts
    DocumentosVencidosModule,
    DocumentosBusquedaModule,
```

- [ ] **Step 8: Correr el script y verificar que pasa**

Run: `cd back4 && npm run test:busqueda-cascada`
Expected: termina con `Todas las verificaciones pasaron ✅` y exit code 0. Si algo falla, el output señala exactamente qué `check(...)` falló.

- [ ] **Step 9: Verificar compilación TypeScript completa**

Run: `cd back4 && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
cd back4
git add src/documentos-busqueda src/app.module.ts scripts/test-busqueda-cascada.ts package.json
git commit -m "feat(back): endpoint de búsqueda total cascada de documentos"
```

---

## Task 2: Frontend — `DocumentosService.buscarCascada()`

**Files:**
- Modify: `front4/src/app/features/documentos/documentos.service.ts`
- Modify: `front4/src/app/features/documentos/documentos.service.spec.ts`

**Interfaces:**
- Consumes: `GET /documentos/busqueda-total?nivel=&categorias=&nombre=` (Task 1) devolviendo `NodoBusqueda[]` (mismo shape que el backend: `_id, nombre, nivel, empresa_id, empresa_nombre, centro_id?, centro_nombre?, documentos, centros, proyectos`).
- Produces: `DocumentosService.busquedaCascada: Signal<NodoBusqueda[]>` y `DocumentosService.buscarCascada(nivel, categorias?, nombre?): void`, consumidos por `DocumentosAdminPageComponent` (Task 3).

- [ ] **Step 1: Escribir el test (fallará porque el método no existe)**

En `front4/src/app/features/documentos/documentos.service.spec.ts`, agregar un segundo bloque `describe` al final del archivo (después del `describe('DocumentosService.subir', ...)` ya existente):

```ts
describe('DocumentosService.buscarCascada', () => {
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

  it('pega a /documentos/busqueda-total con nivel, categorias y nombre, y arma la URL de cada documento según su nivel', () => {
    service.buscarCascada('centro', ['Contrato', 'Factura'], 'acme');

    const req = httpMock.expectOne(r => r.url.includes('/documentos/busqueda-total'));
    expect(req.request.params.get('nivel')).toBe('centro');
    expect(req.request.params.get('categorias')).toBe('Contrato,Factura');
    expect(req.request.params.get('nombre')).toBe('acme');

    req.flush([
      {
        _id: 'centro1', nombre: 'Centro Norte', nivel: 'centro',
        empresa_id: 'emp1', empresa_nombre: 'Empresa Acme',
        documentos: [{ _id: 'doc1', nombre_display: 'Contrato Centro Norte', categoria: 'Contrato' }],
        centros: [],
        proyectos: [{
          _id: 'proy1', nombre: 'Proyecto Cableado', nivel: 'proyecto',
          empresa_id: 'emp1', empresa_nombre: 'Empresa Acme', centro_id: 'centro1', centro_nombre: 'Centro Norte',
          documentos: [{ _id: 'doc2', nombre_display: 'Contrato Cableado', categoria: 'Contrato' }],
          centros: [], proyectos: [],
        }],
      },
    ]);

    const arbol = service.busquedaCascada();
    expect(arbol[0].documentos[0].url).toContain('/empresas/emp1/centros/centro1/documentos/doc1');
    expect(arbol[0].proyectos[0].documentos[0].url).toContain('/empresas/emp1/centros/centro1/proyectos/proy1/documentos/doc2');
  });

  it('omite categorias y nombre del query string cuando no se pasan', () => {
    service.buscarCascada('empresa');
    const req = httpMock.expectOne(r => r.url.includes('/documentos/busqueda-total'));
    expect(req.request.params.get('nivel')).toBe('empresa');
    expect(req.request.params.has('categorias')).toBe(false);
    expect(req.request.params.has('nombre')).toBe(false);
    req.flush([]);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd front4 && npx vitest run documentos.service.spec.ts`
Expected: FAIL — `service.buscarCascada is not a function` (o similar).

- [ ] **Step 3: Agregar los tipos y el método al servicio**

En `front4/src/app/features/documentos/documentos.service.ts`, agregar después de la interfaz `DocumentoVencidoItem` (línea 60):

```ts
export interface DocBusquedaItem {
  _id: string;
  nombre_display: string;
  categoria?: string;
  tipo_mime?: string;
  tamano_bytes?: number;
  subido_en?: string;
  subido_por_nombre?: string;
  tipo_contenido?: 'archivo' | 'link';
  link_url?: string;
  url: string;
}

export interface NodoBusqueda {
  _id: string;
  nombre: string;
  nivel: 'empresa' | 'centro' | 'proyecto';
  empresa_id: string;
  empresa_nombre: string;
  centro_id?: string;
  centro_nombre?: string;
  documentos: DocBusquedaItem[];
  centros: NodoBusqueda[];
  proyectos: NodoBusqueda[];
}
```

Agregar el signal junto a `documentosVencidos` (línea 76):

```ts
  readonly busquedaCascada = signal<NodoBusqueda[]>([]);
```

Agregar el método junto a `cargarVencidos` (después de su cierre, alrededor de la línea 316):

```ts
  buscarCascada(nivel: 'empresa' | 'centro' | 'proyecto', categorias?: string[], nombre?: string): void {
    const params: Record<string, string> = { nivel };
    if (categorias?.length) params['categorias'] = categorias.join(',');
    if (nombre?.trim())     params['nombre'] = nombre.trim();
    const qs = new URLSearchParams(params).toString();

    this.http.get<NodoBusqueda[]>(this.api.url(`/documentos/busqueda-total?${qs}`)).subscribe({
      next:  (arbol) => this.busquedaCascada.set(arbol.map(n => this.mapearNodo(n))),
      error: ()      => this.busquedaCascada.set([]),
    });
  }

  private mapearNodo(n: NodoBusqueda): NodoBusqueda {
    return {
      ...n,
      documentos: n.documentos.map(d => ({ ...d, url: this.api.url(this.urlDocCascada(n, d._id)) })),
      centros:    n.centros.map(c => this.mapearNodo(c)),
      proyectos:  n.proyectos.map(p => this.mapearNodo(p)),
    };
  }

  private urlDocCascada(n: NodoBusqueda, docId: string): string {
    if (n.nivel === 'empresa') return `/empresas/${n.empresa_id}/documentos/${docId}`;
    if (n.nivel === 'centro')  return `/empresas/${n.empresa_id}/centros/${n.centro_id}/documentos/${docId}`;
    return `/empresas/${n.empresa_id}/centros/${n.centro_id}/proyectos/${n._id}/documentos/${docId}`;
  }
```

Mismo patrón que `cargarVencidos` (arriba): `URLSearchParams` + query string embebido en la URL, sin `HttpParams`. `HttpTestingController` sigue exponiendo `req.request.params` parseado desde la URL final, así que los asserts del test del Step 1 funcionan igual.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd front4 && npx vitest run documentos.service.spec.ts`
Expected: PASS, todos los tests (los nuevos y los 3 de `subir` ya existentes).

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/features/documentos/documentos.service.ts src/app/features/documentos/documentos.service.spec.ts
git commit -m "feat(front): DocumentosService.buscarCascada para búsqueda total cascada"
```

---

## Task 3: Frontend — UI de búsqueda total cascada en `documentos-admin-page`

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`

**Interfaces:**
- Consumes: `service.busquedaCascada: Signal<NodoBusqueda[]>` y `service.buscarCascada(nivel, categorias?, nombre?)` (Task 2); `this.panels[tipo]: PanelState` (ya existente); `this.onEmpresaChange()/onCentroChange()/onProyectoChange()` (ya existentes); `this.abrirDocumento(doc)` (ya existente, acepta `{ tipo_contenido?, link_url?, url, nombre_display }`, shape compatible con `DocBusquedaItem`).
- Produces: nada consumido por otras tasks — es la hoja del árbol de dependencias de este plan.

- [ ] **Step 1: Agregar el signal `nivelBusqueda` y los métodos de la cascada**

En `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`, agregar el signal junto a `tabDocAdmin` (línea 75):

```ts
  protected nivelBusqueda = signal<'empresa' | 'centro' | 'proyecto'>('empresa');
```

Agregar los métodos nuevos junto a `activarTabVencidosAdmin()` (alrededor de la línea 928):

```ts
  seleccionarNivelBusqueda(nivel: 'empresa' | 'centro' | 'proyecto'): void {
    this.nivelBusqueda.set(nivel);
    this.refrescarBusquedaCascada();
  }

  refrescarBusquedaCascada(): void {
    const { filtrosCategorias, busqueda } = this.panels[this.docTipoActual];
    this.service.buscarCascada(this.nivelBusqueda(), filtrosCategorias, busqueda);
  }

  onBusquedaNombreChange(tipo: DocTipo, valor: string): void {
    this.panels[tipo].busqueda = valor;
    this.refrescarBusquedaCascada();
  }

  limpiarFiltroDocTipo(tipo: DocTipo): void {
    this.panels[tipo].busqueda = '';
    this.panels[tipo].filtrosCategorias = [];
    this.refrescarBusquedaCascada();
  }

  seleccionarNodoCascada(empresaId: string, centroId?: string, proyectoId?: string): void {
    this.selectedEmpresaId = empresaId;
    this.onEmpresaChange();
    if (centroId) {
      this.selectedCentroId = centroId;
      this.onCentroChange();
    }
    if (proyectoId) {
      this.selectedProyectoId = proyectoId;
      this.onProyectoChange();
    }
  }
```

Modificar `toggleFiltroCategoria` (línea 584) para que también refresque la cascada:

```ts
  toggleFiltroCategoria(tipo: DocTipo, cat: string): void {
    const filtros = this.panels[tipo].filtrosCategorias;
    const idx = filtros.indexOf(cat);
    if (idx === -1) filtros.push(cat);
    else filtros.splice(idx, 1);
    this.refrescarBusquedaCascada();
  }
```

Modificar `seleccionarTabJerarquia` (línea 933) para refrescar la cascada cuando cambia el tab izquierdo (porque cambia `docTipoActual`, y con él qué bucket de `panels[]` filtra la cascada):

```ts
  seleccionarTabJerarquia(tab: 'empresa' | 'centro' | 'proyecto'): void {
    this.tabJerarquia.set(tab);
    this.tabAdminActiva.set('documentacion');
    if (this.tabDocAdmin() === 'vencidos') this.cargarVencidosAdmin();
    this.refrescarBusquedaCascada();
  }
```

Modificar `ngOnInit()` (línea 390) para cargar el árbol inicial:

```ts
  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
    this.solicitudesService.cargar(this.selectedEmpresaId);
    this.usuariosService.cargar();
    this.refrescarBusquedaCascada();
  }
```

- [ ] **Step 2: Compilar y verificar que no hay errores de tipo**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores.

- [ ] **Step 3: Dividir la Tarjeta A en 2 columnas y conectar los bindings del panel de filtro existente a los nuevos métodos**

En `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`, cambiar el `[(ngModel)]` de búsqueda por nombre (línea 23) para que también dispare el refresco:

```html
            <input type="text" [ngModel]="panels[docTipo].busqueda" (ngModelChange)="onBusquedaNombreChange(docTipo, $event)" placeholder="Nombre del documento…" />
```

Cambiar el botón "Limpiar" (línea 25-26) para usar el nuevo método:

```html
          <button class="btn-ghost" style="font-size:.8rem;padding:.45rem .9rem;white-space:nowrap;align-self:flex-end"
            (click)="limpiarFiltroDocTipo(docTipo)">Limpiar</button>
```

Cambiar la apertura del contenedor de Tarjeta A (línea 64) a un grid de 2 columnas, y envolver el contenido existente (desde `<!-- Tab strip -->` en línea 66 hasta el cierre `</div>` de la línea 274, justo antes del comentario `<!-- fin tarjeta A -->`) en un `<div>` de la primera columna:

```html
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:1rem;display:grid;grid-template-columns:1fr 1fr">

    <div style="border-right:1px solid #f0f0f0">
    <!-- Tab strip -->
    <div style="padding:.5rem;border-bottom:1px solid #f0f0f0">
```

(El resto del bloque de tabs + paneles resumen/select, líneas 67 a 274 del archivo original, queda exactamente igual — solo se agrega la apertura de un `<div>` nuevo antes y su cierre después.)

Justo antes de `</div> <!-- fin tarjeta A -->` (línea 276 original), cerrar el `<div>` de la primera columna y agregar la segunda columna con los 3 botones de nivel y el árbol:

```html
    </div>
    <!-- fin columna 1: selector de contexto -->

    <div style="padding:.75rem">
      <p style="margin:0 0 .5rem;font-size:.8rem;font-weight:600;color:#374151">Búsqueda total cascada</p>
      <div style="display:flex;gap:.25rem;background:#f3f4f6;border-radius:10px;padding:.25rem;margin-bottom:.75rem">
        <button
          style="flex:1;padding:.4rem .6rem;border-style:solid;border-width:1px;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer"
          [style.background]="nivelBusqueda() === 'empresa' ? 'rgba(0,149,214,.08)' : 'transparent'"
          [style.color]="nivelBusqueda() === 'empresa' ? '#0095d6' : '#6b7280'"
          [style.borderColor]="nivelBusqueda() === 'empresa' ? 'rgba(0,149,214,.18)' : 'transparent'"
          (click)="seleccionarNivelBusqueda('empresa')">Empresa</button>
        <button
          style="flex:1;padding:.4rem .6rem;border-style:solid;border-width:1px;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer"
          [style.background]="nivelBusqueda() === 'centro' ? 'rgba(16,185,129,.08)' : 'transparent'"
          [style.color]="nivelBusqueda() === 'centro' ? '#059669' : '#6b7280'"
          [style.borderColor]="nivelBusqueda() === 'centro' ? 'rgba(16,185,129,.18)' : 'transparent'"
          (click)="seleccionarNivelBusqueda('centro')">Centro</button>
        <button
          style="flex:1;padding:.4rem .6rem;border-style:solid;border-width:1px;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer"
          [style.background]="nivelBusqueda() === 'proyecto' ? 'rgba(245,158,11,.08)' : 'transparent'"
          [style.color]="nivelBusqueda() === 'proyecto' ? '#d97706' : '#6b7280'"
          [style.borderColor]="nivelBusqueda() === 'proyecto' ? 'rgba(245,158,11,.18)' : 'transparent'"
          (click)="seleccionarNivelBusqueda('proyecto')">Proyecto</button>
      </div>

      <div style="max-height:420px;overflow-y:auto">
        @if (service.busquedaCascada().length === 0) {
          <p class="empty">Sin resultados para el filtro actual.</p>
        }
        @for (nodo of service.busquedaCascada(); track nodo._id) {
          <div style="margin-bottom:.5rem">
            <button class="btn-ghost" style="width:100%;text-align:left;font-weight:700;display:flex;justify-content:space-between"
              (click)="seleccionarNodoCascada(nodo.empresa_id, nodo.centro_id, nodo.nivel === 'proyecto' ? nodo._id : undefined)">
              <span>{{ nodo.nivel === 'empresa' ? '📁' : nodo.nivel === 'centro' ? '🏢' : '📂' }} {{ nodo.nombre }}</span>
              @if (nodo.nivel !== 'empresa') {
                <span style="color:#9ca3af;font-weight:400">{{ nodo.empresa_nombre }}{{ nodo.nivel === 'proyecto' ? ' · ' + nodo.centro_nombre : '' }}</span>
              }
            </button>
            @for (doc of nodo.documentos; track doc._id) {
              <div style="padding:.3rem .5rem .3rem 1.5rem;font-size:.8rem;color:#374151;cursor:pointer;display:flex;align-items:center;gap:.4rem"
                (click)="abrirDocumento(doc)">
                <span>📄</span><span>{{ doc.nombre_display }}</span>
                @if (doc.categoria) { <span style="font-size:.68rem;padding:.1rem .4rem;border-radius:999px;background:#e0e7ff;color:#3730a3">{{ doc.categoria }}</span> }
              </div>
            }
            @if (nodo.nivel !== 'proyecto') {
              @for (centro of nodo.centros; track centro._id) {
                <div style="margin-left:1.25rem">
                  <button class="btn-ghost" style="width:100%;text-align:left" (click)="seleccionarNodoCascada(centro.empresa_id, centro._id)">
                    🏢 {{ centro.nombre }}
                  </button>
                  @for (doc of centro.documentos; track doc._id) {
                    <div style="padding:.3rem .5rem .3rem 1.5rem;font-size:.8rem;color:#374151;cursor:pointer;display:flex;align-items:center;gap:.4rem"
                      (click)="abrirDocumento(doc)">
                      <span>📄</span><span>{{ doc.nombre_display }}</span>
                      @if (doc.categoria) { <span style="font-size:.68rem;padding:.1rem .4rem;border-radius:999px;background:#e0e7ff;color:#3730a3">{{ doc.categoria }}</span> }
                    </div>
                  }
                  @for (proyecto of centro.proyectos; track proyecto._id) {
                    <div style="margin-left:1.25rem">
                      <button class="btn-ghost" style="width:100%;text-align:left" (click)="seleccionarNodoCascada(proyecto.empresa_id, proyecto.centro_id, proyecto._id)">
                        📂 {{ proyecto.nombre }}
                      </button>
                      @for (doc of proyecto.documentos; track doc._id) {
                        <div style="padding:.3rem .5rem .3rem 1.5rem;font-size:.8rem;color:#374151;cursor:pointer;display:flex;align-items:center;gap:.4rem"
                          (click)="abrirDocumento(doc)">
                          <span>📄</span><span>{{ doc.nombre_display }}</span>
                          @if (doc.categoria) { <span style="font-size:.68rem;padding:.1rem .4rem;border-radius:999px;background:#e0e7ff;color:#3730a3">{{ doc.categoria }}</span> }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }
            @if (nodo.nivel === 'centro') {
              @for (proyecto of nodo.proyectos; track proyecto._id) {
                <div style="margin-left:1.25rem">
                  <button class="btn-ghost" style="width:100%;text-align:left" (click)="seleccionarNodoCascada(proyecto.empresa_id, proyecto.centro_id, proyecto._id)">
                    📂 {{ proyecto.nombre }}
                  </button>
                  @for (doc of proyecto.documentos; track doc._id) {
                    <div style="padding:.3rem .5rem .3rem 1.5rem;font-size:.8rem;color:#374151;cursor:pointer;display:flex;align-items:center;gap:.4rem"
                      (click)="abrirDocumento(doc)">
                      <span>📄</span><span>{{ doc.nombre_display }}</span>
                      @if (doc.categoria) { <span style="font-size:.68rem;padding:.1rem .4rem;border-radius:999px;background:#e0e7ff;color:#3730a3">{{ doc.categoria }}</span> }
                    </div>
                  }
                </div>
              }
            }
          </div>
        }
      </div>
    </div>

  </div> <!-- fin tarjeta A -->
```

Nota: el bloque `@if (nodo.nivel !== 'proyecto') { @for (centro of nodo.centros; ...) }` cubre tanto `nivel='empresa'` (nodo raíz con sus `.centros`) como el caso general; el bloque separado `@if (nodo.nivel === 'centro') { @for (proyecto of nodo.proyectos; ...) }` cubre cuando el nodo raíz YA es un centro (nivel=centro) y hay que pintar sus proyectos sin volver a envolver en otro nivel de centro. Cuando `nivel='proyecto'`, los nodos raíz ya son proyectos — sin hijos que pintar, solo sus `documentos`.

- [ ] **Step 4: Compilar**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores.

- [ ] **Step 5: Verificación manual en navegador**

Run: `cd front4 && npm start` (y en otra terminal `cd back4 && npm run start:dev` si no está corriendo)

En `http://localhost:4200`, loguear como `super_admin`, ir a Documentos (admin):
- Verificar que la Tarjeta A ahora se ve en 2 columnas: selector de contexto (igual que antes) a la izquierda, árbol nuevo a la derecha.
- Con nivel "Empresa" activo (default), confirmar que aparecen todas las empresas con sus centros y proyectos.
- Marcar una categoría en "Filtrar por tipo" (arriba de todo) y confirmar que el árbol se poda a solo las ramas con esa categoría.
- Cambiar a nivel "Proyecto" con una categoría marcada y confirmar que aparece una lista plana de proyectos de distintas empresas con documentos de esa categoría.
- Hacer clic en un documento del árbol y confirmar que se abre/descarga.
- Hacer clic en un nodo (empresa/centro/proyecto) del árbol y confirmar que el panel izquierdo cambia a ese contexto y que la Tarjeta B (Documentación/Solicitudes) de abajo se actualiza con esa entidad.

Expected: todo lo anterior funciona sin errores en la consola del navegador.

- [ ] **Step 6: Commit**

```bash
cd front4
git add src/app/features/documentos/pages/documentos-admin-page.component.ts src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front): UI de búsqueda total cascada en Documentos (admin)"
```
