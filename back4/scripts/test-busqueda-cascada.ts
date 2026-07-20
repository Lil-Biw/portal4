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
    { _id: empresaA, razon_social: 'Empresa Acme', rut: '76.111.111-1', activo: true },
    { _id: empresaB, razon_social: 'Empresa Beta', rut: '76.222.222-2', activo: true },
    { _id: empresaC, razon_social: 'Empresa Inactiva', rut: '76.333.333-3', activo: false },
  ]);

  const centroNorte = oid();
  const centroSur = oid();
  const centroPoniente = oid();
  await db.collection('centros_costos').insertMany([
    { _id: centroNorte, nombre: 'Centro Norte', codigo: 'CN', cliente_id: empresaA, activo: true },
    { _id: centroSur, nombre: 'Centro Sur', codigo: 'CS', cliente_id: empresaA, activo: true },
    { _id: centroPoniente, nombre: 'Centro Poniente', codigo: 'CP', cliente_id: empresaB, activo: true },
  ]);

  const proyectoCableado = oid();
  const proyectoRedes = oid();
  const proyectoAire = oid();
  // Proyecto que pertenece a 2 centros a la vez (centro_costo_ids con varios ids) — no lleva
  // documentos propios para no afectar los checks filtrados por categoría 'Contrato' de más
  // abajo (con hayFiltro=false no se poda, así que igual aparece en las consultas sin filtro).
  const proyectoDoble = oid();
  await db.collection('proyectos').insertMany([
    { _id: proyectoCableado, nombre: 'Proyecto Cableado', codigo: 'P1', cliente_id: empresaA, centro_costo_ids: [centroNorte] },
    { _id: proyectoRedes, nombre: 'Proyecto Redes', codigo: 'P2', cliente_id: empresaA, centro_costo_ids: [centroNorte] },
    { _id: proyectoAire, nombre: 'Proyecto Aire', codigo: 'P3', cliente_id: empresaB, centro_costo_ids: [centroPoniente] },
    { _id: proyectoDoble, nombre: 'Proyecto Doble Centro', codigo: 'P4', cliente_id: empresaA, centro_costo_ids: [centroNorte, centroPoniente] },
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

  // ── nivel=proyecto, deduplicación de proyecto multi-centro ────────────────
  // Proyecto Doble Centro pertenece a Centro Norte (Empresa Acme) y Centro Poniente
  // (Empresa Beta) a la vez. En el árbol (nivel=empresa/centro) debe aparecer una vez
  // bajo cada centro (comportamiento intencional). En la lista PLANA de nivel=proyecto
  // debe aparecer una sola vez (antes del fix aparecía 2 veces con el mismo _id).
  const proyectosSinFiltro = await service.buscar('proyecto');
  const idsProyectosSinFiltro = proyectosSinFiltro.map((p: any) => p._id);
  check(new Set(idsProyectosSinFiltro).size === idsProyectosSinFiltro.length,
    'nivel=proyecto sin filtro no contiene _id duplicados');
  check(proyectosSinFiltro.filter((p: any) => p.nombre === 'Proyecto Doble Centro').length === 1,
    'Proyecto Doble Centro (2 centros) aparece UNA sola vez en la lista plana nivel=proyecto');
  check(proyectosSinFiltro.length === 4,
    `total de proyectos únicos sin filtro es 4, cableado+redes+aire+doble (${proyectosSinFiltro.length})`);

  const arbolParaDoble = await service.buscar('empresa');
  const acmeDoble = arbolParaDoble.find((e: any) => e.nombre === 'Empresa Acme');
  const betaDoble = arbolParaDoble.find((e: any) => e.nombre === 'Empresa Beta');
  const centroNorteNode = acmeDoble?.centros.find((c: any) => c.nombre === 'Centro Norte');
  const centroPonienteNode = betaDoble?.centros.find((c: any) => c.nombre === 'Centro Poniente');
  check(
    !!centroNorteNode?.proyectos.some((p: any) => p.nombre === 'Proyecto Doble Centro') &&
    !!centroPonienteNode?.proyectos.some((p: any) => p.nombre === 'Proyecto Doble Centro'),
    'en el árbol (nivel=empresa/centro), Proyecto Doble Centro sigue apareciendo bajo AMBOS centros (no se deduplica ahí, es intencional)',
  );

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
