// Prueba end-to-end de los recordatorios de proyectos y actividades.
// npm run test:recordatorios   (usa ts-node; tsx no sirve aquí porque no emite
// la metadata de decoradores que necesitan los schemas de Nest)
//
// - Corre contra una base de datos TEMPORAL (portal4_test_recordatorios) derivada
//   del MONGODB_URI del .env; se borra al final. No toca datos reales.
// - Intercepta MailService: no se envía ningún correo, solo se registra qué
//   se habría enviado y a quién.
// - Siembra escenarios con distintas fechas y dias_recordatorio, ejecuta los
//   mismos métodos que disparan los crons de /tareas y verifica el resultado.
import 'dotenv/config';

const TEST_DB = 'portal4_test_recordatorios';
const DIA_MS = 86_400_000;

function uriConDb(uri: string, db: string): string {
  try {
    const u = new URL(uri);
    u.pathname = `/${db}`;
    return u.toString();
  } catch {
    // mongodb:// con múltiples hosts no siempre parsea como URL
    const [main, query] = uri.split('?');
    const sinDb = main.replace(/\/[^/]*$/, '');
    return `${sinDb}/${db}${query ? `?${query}` : ''}`;
  }
}

interface CorreoCapturado {
  tipo: string;
  destinatarios: string[];
  detalle: string;
}

async function main() {
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';
  process.env.MONGODB_URI = uriConDb(baseUri, TEST_DB);
  console.log(`Base de datos de prueba: ${TEST_DB}`);

  // Imports dinámicos DESPUÉS de fijar MONGODB_URI (app.module lo lee al importarse)
  const { NestFactory } = await import('@nestjs/core');
  const { Types } = await import('mongoose');
  const { getConnectionToken } = await import('@nestjs/mongoose');
  const { AppModule } = await import('../src/app.module');
  const { ProyectosService } = await import('../src/proyectos/proyectos.service');
  const { ActividadesService } = await import('../src/actividades/actividades.service');
  const { RecordatoriosService } = await import('../src/recordatorios/recordatorios.service');
  const { MailService } = await import('../src/mail/mail.service');
  const { hoyUtcChile } = await import('../src/common/helpers/fechas.helper');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const conn: any = app.get(getConnectionToken());
  const db = conn.db;

  const correos: CorreoCapturado[] = [];
  const mail: any = app.get(MailService);
  mail.notificarProyectoPorVencer = async (args: any) => {
    correos.push({
      tipo: 'proyecto-por-vencer',
      destinatarios: args.destinatarios.map((d: any) => d.email),
      detalle: `${args.proyecto.nombre} — quedan ${args.proyecto.diasRestantes} día(s)`,
    });
  };
  mail.notificarActividadPorVencer = async (args: any) => {
    correos.push({
      tipo: 'actividad-por-vencer',
      destinatarios: args.destinatarios.map((d: any) => d.email),
      detalle: `${args.actividad.nombre} — quedan ${args.actividad.diasRestantes} día(s)`,
    });
  };
  mail.notificarProyectoCerrado = async (args: any) => {
    correos.push({
      tipo: 'proyecto-cerrado',
      destinatarios: args.destinatarios.map((d: any) => d.email),
      detalle: args.proyecto.nombre,
    });
  };

  // ── Siembra ─────────────────────────────────────────────────────────────
  // Misma base de "hoy" que usan los services (fecha de Chile), para que las
  // pruebas no fallen si corren entre medianoche UTC y medianoche chilena.
  const baseUtc = hoyUtcChile();
  const enDias = (n: number) => new Date(baseUtc + n * DIA_MS);
  const oid = () => new Types.ObjectId();

  const empresaId = oid();
  const centroId = oid();
  await db.collection('clientes').insertOne({ _id: empresaId, razon_social: 'Empresa Test Recordatorios' });
  await db.collection('centros_costos').insertOne({ _id: centroId, nombre: 'Centro Test', cliente_id: empresaId });
  // Suscrito explícitamente a la empresa → recibe recordatorios.
  await db.collection('usuarios').insertOne({
    _id: oid(), nombre: 'Admin Test', email: 'admin-test@example.com', password_hash: 'x',
    rol: 'admin_smartclarity', activo: true, notificar_todas_empresas: false,
    empresas_suscritas: [empresaId],
  });
  // Solo el toggle global (default true), sin suscripciones puntuales →
  // recibe eventos (p. ej. cierre de proyecto) pero NO recordatorios.
  await db.collection('usuarios').insertOne({
    _id: oid(), nombre: 'Admin Global', email: 'admin-global@example.com', password_hash: 'x',
    rol: 'admin_smartclarity', activo: true, notificar_todas_empresas: true,
  });

  // Cada fixture produce un doc en `proyectos`/`actividades` y, si tiene
  // fecha_fin/fecha, su doc espejo en `recordatorios` (lo que haría
  // ProyectosService/ActividadesService.sincronizar() en create/update reales).
  const recordatoriosSeed: Record<string, unknown>[] = [];

  const TODOS = [30, 15, 7, 3, 1, 0];
  // dias === undefined → no se crea doc en `recordatorios` (entidad nunca pasó por
  // create/update con el flujo nuevo). dias === [] → sí hay doc, pero sin umbrales.
  const proyecto = (nombre: string, fechaFin: Date | null, dias?: number[], estado = 'en_ejecucion', ultimoAviso?: number) => {
    const _id = oid();
    if (fechaFin && dias !== undefined) {
      recordatoriosSeed.push({
        tipo: 'proyecto', entidad_id: _id, dias, fecha_fin: fechaFin,
        ...(ultimoAviso !== undefined ? { ultimo_recordatorio_dias: ultimoAviso } : {}),
      });
    }
    return { _id, nombre, codigo: nombre, cliente_id: empresaId, centro_costo_ids: [centroId], estado, fecha_fin: fechaFin };
  };
  const vencidoAyer = proyecto('P-vencido-ayer', enDias(-1), TODOS);
  const venceEn7 = proyecto('P-vence-en-7', enDias(7), TODOS);
  const postergado = proyecto('P-postergado-vence-en-3', enDias(3));
  await db.collection('proyectos').insertMany([
    venceEn7,
    proyecto('P-vence-en-7-sin-dias', enDias(7), []),
    // sin coincidencia exacta: quedan 2 días pero solo hay umbrales en 7 y 30 → no avisa
    proyecto('P-vence-en-2-solo-7-30', enDias(2), [7, 30]),
    proyecto('P-vence-hoy', enDias(0), [0]),
    vencidoAyer,
    proyecto('P-sin-recordatorio', enDias(7)),
    // recordatorio desincronizado (stale) de un proyecto ya movido a cierre manualmente:
    // el filtro defensivo de estado debe excluirlo, no debe notificar ni re-mover.
    proyecto('P-cierre-pendiente-vence-en-7', enDias(7), TODOS, 'cierre_pendiente'),
    // idempotencia: el umbral 7 ya fue notificado → no repite
    proyecto('P-ya-avisado-7', enDias(7), TODOS, 'en_ejecucion', 7),
    // avisado antes en el umbral 15; hoy cruza el 7 → avisa de nuevo
    proyecto('P-avisado-15-vence-en-7', enDias(7), TODOS, 'en_ejecucion', 15),
    // se pospone el plazo (edición real): sin dias aquí porque el doc de
    // recordatorios se siembra a mano más abajo y luego se "edita" vía
    // recordatoriosService.sincronizar(), como haría ProyectosService.update()
    postergado,
    // recién creado con 28 días restantes (nunca hubo un "hoy" en 30): no debe
    // avisar hasta que el conteo llegue a un umbral real (15, 7, ...)
    proyecto('P-nuevo-vence-en-28', enDias(28), TODOS),
  ]);

  const actividad = (nombre: string, fecha: Date, dias?: number[], fechaTermino?: Date, ultimoAviso?: number) => {
    const _id = oid();
    if (dias !== undefined) {
      recordatoriosSeed.push({
        tipo: 'actividad', entidad_id: _id, dias, fecha_fin: fechaTermino ?? fecha,
        ...(ultimoAviso !== undefined ? { ultimo_recordatorio_dias: ultimoAviso } : {}),
      });
    }
    return { _id, nombre, tipo_id: oid(), centro_costo_id: centroId, fecha, ...(fechaTermino ? { fecha_termino: fechaTermino } : {}) };
  };
  const aPasada = actividad('A-pasada', enDias(-2), TODOS);
  await db.collection('actividades').insertMany([
    actividad('A-en-3-dias', enDias(3), [3]),
    actividad('A-en-3-dias-sin-dias', enDias(3), []),
    actividad('A-hoy', enDias(0), [0]),
    // sin coincidencia exacta: quedan 3 días pero el único umbral configurado es 7 → no avisa
    actividad('A-en-3-dias-solo-7', enDias(3), [7]),
    actividad('A-multi-dia-termina-manana', enDias(-5), [1], enDias(1)),
    aPasada,
    actividad('A-sin-recordatorio', enDias(3)),
    // idempotencia: el umbral 3 ya fue notificado → no repite
    actividad('A-ya-avisada-3', enDias(3), [3], undefined, 3),
  ]);

  // P-postergado-vence-en-3: simula un recordatorio ya notificado (umbral 3) bajo
  // una fecha_fin ANTERIOR, y luego una edición real del proyecto que pospone el
  // plazo a "vence en 3 días" de nuevo — vía recordatoriosService.sincronizar(),
  // el mismo camino que usa ProyectosService.update(). Sin el reset de
  // ultimo_recordatorio_dias al cambiar fecha_fin, el cron no debería avisar
  // (bug); con el fix, sí debe avisar porque el plazo cambió.
  recordatoriosSeed.push({
    tipo: 'proyecto', entidad_id: postergado._id, dias: TODOS,
    fecha_fin: enDias(-4), ultimo_recordatorio_dias: 3,
  });

  await db.collection('recordatorios').insertMany(recordatoriosSeed);

  const recordatoriosService: any = app.get(RecordatoriosService);
  await recordatoriosService.sincronizar('proyecto', postergado._id, TODOS, enDias(3));

  // ── Ejecución (lo mismo que dispara /tareas/recordatorios-*) ────────────
  const proyectosService: any = app.get(ProyectosService);
  const actividadesService: any = app.get(ActividadesService);
  const resPro = await proyectosService.enviarRecordatoriosVencimiento();
  const resAct = await actividadesService.enviarRecordatoriosVencimiento();

  console.log(`\nCron proyectos   → ${JSON.stringify(resPro)}`);
  console.log(`Cron actividades → ${JSON.stringify(resAct)}`);
  console.log('\nCorreos capturados:');
  for (const c of correos) console.log(`  [${c.tipo}] ${c.detalle} → ${c.destinatarios.join(', ')}`);

  // ── Verificación ────────────────────────────────────────────────────────
  const esperados: [string, string][] = [
    ['proyecto-por-vencer', 'P-vence-en-7 — quedan 7 día(s)'],
    ['proyecto-por-vencer', 'P-vence-hoy — quedan 0 día(s)'],
    ['proyecto-por-vencer', 'P-avisado-15-vence-en-7 — quedan 7 día(s)'],
    ['proyecto-por-vencer', 'P-postergado-vence-en-3 — quedan 3 día(s)'],
    ['proyecto-cerrado', 'P-vencido-ayer'],
    ['actividad-por-vencer', 'A-en-3-dias — quedan 3 día(s)'],
    ['actividad-por-vencer', 'A-hoy — quedan 0 día(s)'],
    ['actividad-por-vencer', 'A-multi-dia-termina-manana — quedan 1 día(s)'],
  ];

  // Ninguna de estas debe generar correo: son casos SIN coincidencia exacta
  // entre "días restantes" y un umbral configurado (el bug reportado: un
  // proyecto recién creado con 28 días restantes notificaba igual, con el
  // umbral 30 más cercano — nunca debe avisar hasta que coincida un valor real).
  const noEsperados: [string, string][] = [
    ['proyecto-por-vencer', 'P-vence-en-2-solo-7-30'],
    ['proyecto-por-vencer', 'P-nuevo-vence-en-28'],
    ['actividad-por-vencer', 'A-en-3-dias-solo-7'],
  ];

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  console.log('\nResultados:');
  for (const [tipo, detalle] of esperados) {
    check(correos.some(c => c.tipo === tipo && c.detalle === detalle), `se envía [${tipo}] ${detalle}`);
  }
  for (const [tipo, nombre] of noEsperados) {
    check(!correos.some(c => c.tipo === tipo && c.detalle.startsWith(nombre)), `NO se envía [${tipo}] ${nombre}`);
  }
  check(correos.length === esperados.length,
    `no hay envíos de más (${correos.length}/${esperados.length})`);

  const porVencer = correos.filter(c => c.tipo.endsWith('por-vencer'));
  check(porVencer.every(c => c.destinatarios.length === 1 && c.destinatarios[0] === 'admin-test@example.com'),
    'los recordatorios van SOLO al admin suscrito explícitamente (el toggle global no aplica)');
  const cierre = correos.find(c => c.tipo === 'proyecto-cerrado');
  check(!!cierre && cierre.destinatarios.includes('admin-global@example.com') && cierre.destinatarios.includes('admin-test@example.com'),
    'el aviso de cierre (evento, no recordatorio) sí respeta el toggle global');

  const cerrado: any = await db.collection('proyectos').findOne({ _id: vencidoAyer._id });
  check(cerrado?.estado === 'cierre_pendiente', 'el proyecto vencido ayer quedó en cierre pendiente');

  const avisado: any = await db.collection('recordatorios').findOne({ tipo: 'proyecto', entidad_id: venceEn7._id });
  check(avisado?.ultimo_recordatorio_dias === 7, 'el umbral notificado queda persistido en recordatorios (ultimo_recordatorio_dias = 7)');

  // Las actividades no tienen auto-cierre, pero su doc vencido en `recordatorios`
  // igual debe limpiarse (si no, quedaría vigilado y reevaluado sin límite para siempre).
  const recordatorioPasada = await db.collection('recordatorios').findOne({ tipo: 'actividad', entidad_id: aPasada._id });
  check(!recordatorioPasada, 'el recordatorio de la actividad vencida se limpia de la colección');

  // Segunda corrida el mismo día: la marca de último umbral evita reenvíos.
  const antes = correos.length;
  const resPro2 = await proyectosService.enviarRecordatoriosVencimiento();
  const resAct2 = await actividadesService.enviarRecordatoriosVencimiento();
  check(correos.length === antes && resPro2.notificados === 0 && resAct2.notificados === 0,
    `segunda corrida el mismo día no reenvía nada (${correos.length - antes} correos extra)`);

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
