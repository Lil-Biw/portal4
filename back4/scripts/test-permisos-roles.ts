// Prueba end-to-end de roles (presets de permisos) y permisos granulares por usuario.
// npm run test:permisos-roles   (usa ts-node, igual que test-desuscripcion-admin.ts)
//
// - Corre contra una base de datos TEMPORAL (portal4_test_permisos_roles) derivada
//   del MONGODB_URI del .env; se borra al final. No toca datos reales.
// - Verifica: CRUD de roles (crear/listar/actualizar/eliminar, nombre único),
//   y que UsuariosService.actualizarPermisos persista el objeto `permisos`
//   del usuario tal cual se le pasa.
import 'dotenv/config';

const TEST_DB = 'portal4_test_permisos_roles';

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
  const { RolesService } = await import('../src/roles/roles.service');
  const { UsuariosService } = await import('../src/usuarios/usuarios.service');
  const { ConflictException, NotFoundException } = await import('@nestjs/common');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const conn: any = app.get(getConnectionToken());
  const db = conn.db;

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  const rolesService: any = app.get(RolesService);
  const usuariosService: any = app.get(UsuariosService);

  // ── Roles: crear, listar, actualizar, eliminar ────────────────────────────
  console.log('\nRoles:');

  const admin = await rolesService.create({
    nombre: 'Administrador',
    permisos: { actividades: { crear: true, editar: true, eliminar: true } },
  });
  check(admin.nombre === 'Administrador', 'crea el rol "Administrador"');

  const usuarioRol = await rolesService.create({ nombre: 'Usuario', permisos: {} });
  check(usuarioRol.nombre === 'Usuario', 'crea el rol "Usuario"');

  let nombreDuplicadoRechazado = false;
  try {
    await rolesService.create({ nombre: 'Administrador', permisos: {} });
  } catch (e) {
    nombreDuplicadoRechazado = e instanceof ConflictException;
  }
  check(nombreDuplicadoRechazado, 'rechaza un nombre de rol duplicado con ConflictException');

  const listado = await rolesService.findAll();
  check(listado.length === 2, `findAll devuelve los 2 roles creados (${listado.length}/2)`);

  const actualizado = await rolesService.update(String(admin._id), {
    permisos: { actividades: { crear: true, editar: true, eliminar: true }, usuarios: { crear: true } },
  });
  check(
    actualizado.permisos.usuarios?.crear === true,
    'update() persiste el nuevo objeto de permisos del rol',
  );

  await rolesService.remove(String(usuarioRol._id));
  let rolEliminadoNoEncontrado = false;
  try {
    await rolesService.findOne(String(usuarioRol._id));
  } catch (e) {
    rolEliminadoNoEncontrado = e instanceof NotFoundException;
  }
  check(rolEliminadoNoEncontrado, 'remove() elimina el rol (findOne posterior lanza NotFoundException)');

  // ── Permisos granulares por usuario ────────────────────────────────────────
  console.log('\nPermisos por usuario:');

  const usuarioId = new Types.ObjectId();
  await db.collection('usuarios').insertOne({
    _id: usuarioId,
    nombre: 'Usuario Test Permisos',
    email: 'permisos-test@example.com',
    password_hash: 'x',
    rol: 'usuario',
    activo: true,
    permisos: {},
  });

  const permisosNuevos = {
    actividades: { crear: true, editar: false, eliminar: false },
    docCentro: { subir: true },
  };
  const usuarioActualizado = await usuariosService.actualizarPermisos(String(usuarioId), {
    permisos: permisosNuevos,
  });
  check(
    JSON.stringify(usuarioActualizado.permisos) === JSON.stringify(permisosNuevos),
    'actualizarPermisos() persiste el objeto permisos tal cual se envía',
  );

  const usuarioReleido = await db.collection('usuarios').findOne({ _id: usuarioId });
  check(
    JSON.stringify(usuarioReleido.permisos) === JSON.stringify(permisosNuevos),
    'el objeto permisos queda persistido en la base de datos',
  );

  let usuarioInexistenteRechazado = false;
  try {
    await usuariosService.actualizarPermisos(String(new Types.ObjectId()), { permisos: {} });
  } catch (e) {
    usuarioInexistenteRechazado = e instanceof NotFoundException;
  }
  check(usuarioInexistenteRechazado, 'actualizarPermisos() sobre un usuario inexistente lanza NotFoundException');

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
