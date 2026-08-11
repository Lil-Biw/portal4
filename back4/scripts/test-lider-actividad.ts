// Prueba del campo "líder de actividad": verifica que ActividadesService.resolverLider
// guarde nombre/correo del admin elegido como snapshot fijo (lider_nombre, lider_email),
// rechace usuarios sin rol admin, y permita reasignar o limpiar el líder al editar.
// npm run test:lider-actividad   (usa ts-node; tsx no sirve aquí porque no emite
// la metadata de decoradores que necesitan los schemas de Nest)
//
// Corre contra una base de datos TEMPORAL (portal4_test_lider_actividad) derivada
// del MONGODB_URI del .env; se borra al final. No toca datos reales.
import 'dotenv/config';

const TEST_DB = 'portal4_test_lider_actividad';

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
  const adminId = oid();
  const superAdminId = oid();
  const usuarioId = oid();
  await db.collection('clientes').insertOne({ _id: empresaId, razon_social: 'Empresa Test Líder' });
  await db.collection('centros_costos').insertOne({ _id: centroId, nombre: 'Centro Test', cliente_id: empresaId, codigo: 'C-TEST' });
  await db.collection('tipos_actividad').insertOne({ _id: tipoId, nombre: 'Tipo Test', color: '#4E9AC7' });
  await db.collection('usuarios').insertOne({
    _id: adminId, nombre: 'Admin Líder', email: 'admin-lider@example.com',
    password_hash: 'x', rol: 'admin_smartclarity', activo: true,
  });
  await db.collection('usuarios').insertOne({
    _id: superAdminId, nombre: 'Super Admin Líder', email: 'super-lider@example.com',
    password_hash: 'x', rol: 'super_admin', activo: true,
  });
  await db.collection('usuarios').insertOne({
    _id: usuarioId, nombre: 'Usuario Común', email: 'usuario-comun@example.com',
    password_hash: 'x', rol: 'usuario', activo: true,
  });

  const controller: any = app.get(ActividadesController);

  const dtoBase = {
    nombre: 'Actividad de prueba',
    tipo_id: tipoId.toString(),
    fecha: new Date(Date.now() + 86_400_000).toISOString(),
    notificacion: { notificar: false },
  };
  const reqSinUsuario = { user: undefined } as any;

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  // Caso 1: lider_id de un admin_smartclarity válido → guarda snapshot
  const conLider = await controller.create(
    centroId.toString(),
    { ...dtoBase, lider_id: adminId.toString() },
    reqSinUsuario,
  );
  check(conLider.lider_nombre === 'Admin Líder', 'guarda lider_nombre del admin elegido');
  check(conLider.lider_email === 'admin-lider@example.com', 'guarda lider_email del admin elegido');
  check(String(conLider.lider_id) === adminId.toString(), 'guarda la referencia lider_id');

  // Caso 2: lider_id de un usuario con rol 'usuario' → rechazado
  let error2: any = null;
  try {
    await controller.create(centroId.toString(), { ...dtoBase, lider_id: usuarioId.toString() }, reqSinUsuario);
  } catch (err: any) {
    error2 = err;
  }
  check(!!error2, 'rechaza un lider_id cuyo usuario no es admin');
  check(error2?.status === 400, 'el rechazo es un BadRequestException (400)');

  // Caso 3: lider_id con formato de ObjectId inválido → rechazado
  let errorFormato: any = null;
  try {
    await controller.create(centroId.toString(), { ...dtoBase, lider_id: 'no-es-un-objectid' }, reqSinUsuario);
  } catch (err: any) {
    errorFormato = err;
  }
  check(!!errorFormato, 'rechaza un lider_id con formato de ObjectId inválido');
  check(errorFormato?.status === 400, 'el rechazo de formato inválido es un BadRequestException (400)');

  // Caso 4: lider_id con formato válido pero sin usuario correspondiente → rechazado
  const idInexistente = oid().toString();
  let errorInexistente: any = null;
  try {
    await controller.create(centroId.toString(), { ...dtoBase, lider_id: idInexistente }, reqSinUsuario);
  } catch (err: any) {
    errorInexistente = err;
  }
  check(!!errorInexistente, 'rechaza un lider_id que no corresponde a ningún usuario');
  check(errorInexistente?.status === 400, 'el rechazo de usuario inexistente es un BadRequestException (400)');

  // Caso 5: sin lider_id → actividad se crea sin líder, sin error
  const sinLider = await controller.create(centroId.toString(), { ...dtoBase }, reqSinUsuario);
  check(!sinLider.lider_nombre, 'sin lider_id no guarda lider_nombre');
  check(!!sinLider._id, 'la actividad se crea igual sin lider_id');

  // Caso 6: editar para reasignar el líder a otro admin → snapshot se actualiza
  const reasignada = await controller.update(String(conLider._id), { lider_id: superAdminId.toString() });
  check(reasignada.lider_nombre === 'Super Admin Líder', 'reasigna el líder y actualiza el nombre');
  check(reasignada.lider_email === 'super-lider@example.com', 'reasigna el líder y actualiza el correo');
  check(String(reasignada.lider_id) === superAdminId.toString(), 'reasigna la referencia lider_id');

  // Caso 7: editar enviando lider_id: '' → limpia el líder
  const limpiada = await controller.update(String(conLider._id), { lider_id: '' });
  check(!limpiada.lider_nombre, "lider_id vacío limpia lider_nombre");
  check(!limpiada.lider_email, "lider_id vacío limpia lider_email");
  check(!limpiada.lider_id, "lider_id vacío limpia la referencia lider_id");

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
