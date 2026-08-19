// Prueba end-to-end de la desuscripción de notificaciones para admin_smartclarity.
// npm run test:desuscripcion   (usa ts-node, igual que test-recordatorios.ts)
//
// - Corre contra una base de datos TEMPORAL (portal4_test_desuscripcion) derivada
//   del MONGODB_URI del .env; se borra al final. No toca datos reales.
// - Intercepta MailService: no se envía ningún correo, solo se registra qué
//   se habría enviado y a quién.
// - Siembra un admin DESUSCRITO (notificar_todas_empresas: false, sin ninguna
//   suscripción puntual) y un admin SUSCRITO explícitamente a la empresa, y
//   dispara los 6 puntos de envío EN LAS DOS AUDIENCIAS posibles:
//     Fase 1 — audiencia 'todos'       (broadcast automático)
//     Fase 2 — audiencia 'especificos' (destinatarios elegidos por ID, que es
//              exactamente lo que manda el wizard de actividades del front)
//   para verificar que el admin desuscrito NO reciba nada en ninguna de las dos.
import 'dotenv/config';

const TEST_DB = 'portal4_test_desuscripcion';

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

interface CorreoCapturado {
  tipo: string;
  destinatarios: string[];
}

async function main() {
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';
  process.env.MONGODB_URI = uriConDb(baseUri, TEST_DB);
  console.log(`Base de datos de prueba: ${TEST_DB}`);

  const { NestFactory } = await import('@nestjs/core');
  const { Types } = await import('mongoose');
  const { getConnectionToken } = await import('@nestjs/mongoose');
  const { AppModule } = await import('../src/app.module');
  const { SolicitudesService } = await import('../src/solicitudes/solicitudes.service');
  const { ClientesService } = await import('../src/clientes/clientes.service');
  const { CentrosCostosService } = await import('../src/centros-costos/centros-costos.service');
  const { ProyectosService } = await import('../src/proyectos/proyectos.service');
  const { ActividadesService } = await import('../src/actividades/actividades.service');
  const { MailService } = await import('../src/mail/mail.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const conn: any = app.get(getConnectionToken());
  const db = conn.db;

  const correos: CorreoCapturado[] = [];
  const mail: any = app.get(MailService);
  const capturar = (tipo: string) => async (args: any) => {
    correos.push({ tipo, destinatarios: args.destinatarios.map((d: any) => d.email) });
  };
  mail.notificarNuevaSolicitud = capturar('nueva-solicitud');
  mail.notificarRechazoSolicitud = capturar('rechazo-solicitud');
  mail.notificarDocumentoVencido = capturar('documento-vencido');
  mail.notificarNuevaActividad = capturar('nueva-actividad');

  // ── Siembra ─────────────────────────────────────────────────────────────
  const oid = () => new Types.ObjectId();
  const ADMIN_DESUSCRITO = 'admin-desuscrito@example.com';
  const ADMIN_SUSCRITO = 'admin-suscrito@example.com';

  const empresaId = oid();
  const centroId = oid();
  const proyectoId = oid();

  await db.collection('clientes').insertOne({
    _id: empresaId, razon_social: 'Empresa Test Desuscripción', rut: '1-9',
    email_contacto: 'contacto@empresa.cl', activo: true,
  });
  await db.collection('centros_costos').insertOne({
    _id: centroId, cliente_id: empresaId, codigo: 'C1', nombre: 'Centro X', activo: true,
  });
  await db.collection('proyectos').insertOne({
    _id: proyectoId, centro_costo_ids: [centroId], cliente_id: empresaId,
    codigo: 'P1', nombre: 'Proyecto X', estado: 'en_ejecucion',
  });
  const tipoActividadId = oid();
  await db.collection('tipos_actividad').insertOne({ _id: tipoActividadId, nombre: 'Mantención', color: '#4E9AC7' });

  // Apagó el toggle global y no dejó ninguna suscripción puntual → se desuscribió de todo.
  const adminDesuscritoId = oid();
  await db.collection('usuarios').insertOne({
    _id: adminDesuscritoId, nombre: 'Admin Desuscrito', email: ADMIN_DESUSCRITO, password_hash: 'x',
    rol: 'admin_smartclarity', activo: true, notificar_todas_empresas: false,
  });
  // Apagó el toggle global pero se suscribió explícitamente a esta empresa.
  const adminSuscritoId = oid();
  await db.collection('usuarios').insertOne({
    _id: adminSuscritoId, nombre: 'Admin Suscrito', email: ADMIN_SUSCRITO, password_hash: 'x',
    rol: 'admin_smartclarity', activo: true, notificar_todas_empresas: false,
    empresas_suscritas: [empresaId],
  });

  const docCliente = oid();
  await db.collection('doc_cliente').insertOne({
    _id: docCliente, cliente_id: empresaId, nombre: 'contrato.pdf', nombre_display: 'Contrato',
    tipo_contenido: 'archivo', categoria: 'Legal', subido_en: new Date(),
  });
  const docCentro = oid();
  await db.collection('doc_centro_costo').insertOne({
    _id: docCentro, centro_costo_id: centroId, nombre: 'factura.pdf', nombre_display: 'Factura',
    tipo_contenido: 'archivo', categoria: 'Financiero', subido_en: new Date(),
  });
  const docProyecto = oid();
  await db.collection('doc_proyecto').insertOne({
    _id: docProyecto, proyecto_id: proyectoId, nombre: 'plano.pdf', nombre_display: 'Plano',
    tipo_contenido: 'archivo', categoria: 'Técnico', subido_en: new Date(),
  });

  // ── Ejecución de los 6 puntos ────────────────────────────────────────────
  const solicitudesService: any = app.get(SolicitudesService);
  const clientesService: any = app.get(ClientesService);
  const centrosCostosService: any = app.get(CentrosCostosService);
  const proyectosService: any = app.get(ProyectosService);
  const actividadesService: any = app.get(ActividadesService);

  const notifTodos = { notificar: true, audiencia: 'todos' as const };

  const solicitud = await solicitudesService.create({
    nombre: 'Solicitud test', tipo: 'Otro', empresa_id: String(empresaId),
    centro_costo_id: String(centroId), notificacion: notifTodos,
  });

  await solicitudesService.cambiarEstado(
    String(solicitud._id), String(empresaId),
    { estado: 'rechazado', motivo_rechazo: 'No cumple requisitos', notificacion: notifTodos },
  );

  await clientesService.vencerDocumento(String(empresaId), String(docCliente), 'Empresa Test Desuscripción', notifTodos);

  await centrosCostosService.vencerDocumento(
    String(centroId), String(docCentro), String(empresaId), 'Empresa Test Desuscripción', 'Centro X', notifTodos,
  );

  await proyectosService.vencerDocumento(
    String(proyectoId), String(docProyecto), String(empresaId), String(centroId),
    'Empresa Test Desuscripción', 'Centro X', 'Proyecto X', notifTodos,
  );

  await actividadesService.create({
    nombre: 'Actividad test', tipo_id: String(tipoActividadId), centro_costo_id: String(centroId),
    fecha: new Date().toISOString(), notificacion: notifTodos,
  });

  const correosFase1 = correos.length;

  // ── Fase 2: audiencia 'especificos', ids explícitos de ambos admins ───────
  // Simula lo que manda el wizard de actividades (y análogos) cuando el
  // operador destilda a cualquier otro destinatario: ya no viaja 'todos',
  // viaja la lista completa de ids seleccionados, incluyendo por error al
  // admin desuscrito si el front lo preseleccionó por defecto.
  const notifEspecificos = {
    notificar: true,
    audiencia: 'especificos' as const,
    destinatarios_ids: [String(adminDesuscritoId), String(adminSuscritoId)],
  };

  const solicitud2 = await solicitudesService.create({
    nombre: 'Solicitud test 2', tipo: 'Otro', empresa_id: String(empresaId),
    centro_costo_id: String(centroId), notificacion: notifEspecificos,
  });

  await solicitudesService.cambiarEstado(
    String(solicitud2._id), String(empresaId),
    { estado: 'rechazado', motivo_rechazo: 'No cumple requisitos', notificacion: notifEspecificos },
  );

  const docCliente2 = oid();
  await db.collection('doc_cliente').insertOne({
    _id: docCliente2, cliente_id: empresaId, nombre: 'contrato2.pdf', nombre_display: 'Contrato 2',
    tipo_contenido: 'archivo', categoria: 'Legal', subido_en: new Date(),
  });
  await clientesService.vencerDocumento(String(empresaId), String(docCliente2), 'Empresa Test Desuscripción', notifEspecificos);

  const docCentro2 = oid();
  await db.collection('doc_centro_costo').insertOne({
    _id: docCentro2, centro_costo_id: centroId, nombre: 'factura2.pdf', nombre_display: 'Factura 2',
    tipo_contenido: 'archivo', categoria: 'Financiero', subido_en: new Date(),
  });
  await centrosCostosService.vencerDocumento(
    String(centroId), String(docCentro2), String(empresaId), 'Empresa Test Desuscripción', 'Centro X', notifEspecificos,
  );

  const docProyecto2 = oid();
  await db.collection('doc_proyecto').insertOne({
    _id: docProyecto2, proyecto_id: proyectoId, nombre: 'plano2.pdf', nombre_display: 'Plano 2',
    tipo_contenido: 'archivo', categoria: 'Técnico', subido_en: new Date(),
  });
  await proyectosService.vencerDocumento(
    String(proyectoId), String(docProyecto2), String(empresaId), String(centroId),
    'Empresa Test Desuscripción', 'Centro X', 'Proyecto X', notifEspecificos,
  );

  await actividadesService.create({
    nombre: 'Actividad test 2', tipo_id: String(tipoActividadId), centro_costo_id: String(centroId),
    fecha: new Date().toISOString(), notificacion: notifEspecificos,
  });

  // ── Verificación ────────────────────────────────────────────────────────
  console.log('\nCorreos capturados:');
  for (const c of correos) console.log(`  [${c.tipo}] → ${c.destinatarios.join(', ')}`);

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  console.log("\nResultados — Fase 1 (audiencia 'todos'):");
  const fase1 = correos.slice(0, correosFase1);
  check(fase1.length === 6, `se dispararon los 6 correos esperados (${fase1.length}/6)`);
  for (const c of fase1) {
    check(!c.destinatarios.includes(ADMIN_DESUSCRITO), `[${c.tipo}] NO incluye al admin desuscrito`);
    check(c.destinatarios.includes(ADMIN_SUSCRITO), `[${c.tipo}] SÍ incluye al admin suscrito explícitamente`);
  }

  console.log("\nResultados — Fase 2 (audiencia 'especificos', ids explícitos):");
  const fase2 = correos.slice(correosFase1);
  check(fase2.length === 6, `se dispararon los 6 correos esperados (${fase2.length}/6)`);
  for (const c of fase2) {
    check(!c.destinatarios.includes(ADMIN_DESUSCRITO), `[${c.tipo}] NO incluye al admin desuscrito`);
    check(c.destinatarios.includes(ADMIN_SUSCRITO), `[${c.tipo}] SÍ incluye al admin suscrito explícitamente`);
  }

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
