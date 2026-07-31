// Prueba del tag "creado por" en actividades: verifica que ActividadesController.create
// persista nombre/correo del usuario autenticado como snapshot fijo (creado_por_nombre,
// creado_por_email), y que la creación no falle si no hay usuario o no se encuentra.
// npm run test:creado-por-actividad   (usa ts-node; tsx no sirve aquí porque no emite
// la metadata de decoradores que necesitan los schemas de Nest)
//
// Corre contra una base de datos TEMPORAL (portal4_test_creado_por_actividad) derivada
// del MONGODB_URI del .env; se borra al final. No toca datos reales.
import 'dotenv/config';

const TEST_DB = 'portal4_test_creado_por_actividad';

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
  const { ActividadesController } = await import('../src/actividades/actividades.controller');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const conn: any = app.get(getConnectionToken());
  const db = conn.db;
  const oid = () => new Types.ObjectId();

  const empresaId = oid();
  const centroId = oid();
  const tipoId = oid();
  const usuarioId = oid();
  await db.collection('clientes').insertOne({ _id: empresaId, razon_social: 'Empresa Test Creador' });
  await db.collection('centros_costos').insertOne({ _id: centroId, nombre: 'Centro Test', cliente_id: empresaId, codigo: 'C-TEST' });
  await db.collection('tipos_actividad').insertOne({ _id: tipoId, nombre: 'Tipo Test', color: '#4E9AC7' });
  await db.collection('usuarios').insertOne({
    _id: usuarioId, nombre: 'Admin Creador', email: 'admin-creador@example.com',
    password_hash: 'x', rol: 'admin_smartclarity', activo: true,
  });

  const controller: any = app.get(ActividadesController);

  const dtoBase = {
    nombre: 'Actividad de prueba',
    tipo_id: tipoId.toString(),
    fecha: new Date(Date.now() + 86_400_000).toISOString(),
    notificacion: { notificar: false },
  };

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  // Caso 1: usuario autenticado válido → guarda snapshot
  const conCreador = await controller.create(
    centroId.toString(),
    { ...dtoBase },
    { user: { sub: usuarioId.toString() } } as any,
  );
  check(conCreador.creado_por_nombre === 'Admin Creador', 'guarda creado_por_nombre del usuario autenticado');
  check(conCreador.creado_por_email === 'admin-creador@example.com', 'guarda creado_por_email del usuario autenticado');
  check(String(conCreador.creado_por) === usuarioId.toString(), 'guarda la referencia creado_por');

  // Caso 2: sin usuario autenticado (req sin user) → crea igual, sin campos de autoría
  const sinCreador = await controller.create(
    centroId.toString(),
    { ...dtoBase },
    { user: undefined } as any,
  );
  check(!sinCreador.creado_por_nombre, 'sin req.user no guarda creado_por_nombre');
  check(!!sinCreador._id, 'la actividad se crea igual sin req.user');

  // Caso 3: creadoPorId que no matchea ningún usuario → crea igual, sin campos de autoría
  const idInexistente = oid().toString();
  const creadorInexistente = await controller.create(
    centroId.toString(),
    { ...dtoBase },
    { user: { sub: idInexistente } } as any,
  );
  check(!creadorInexistente.creado_por_nombre, 'con un id de usuario inexistente no guarda creado_por_nombre');
  check(!!creadorInexistente._id, 'la actividad se crea igual con un id de usuario inexistente');

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
