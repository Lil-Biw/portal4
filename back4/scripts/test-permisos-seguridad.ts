// Auditoría E2E de autorización: levanta el servidor HTTP real (con todos los
// guards activos) contra una base de datos TEMPORAL y ejercita cada endpoint
// con tokens JWT reales de distintos roles, igual que lo haría un atacante o
// un usuario legítimo desde el navegador. No llama a los services directamente
// (eso saltaría los guards) — todo pasa por fetch() contra localhost.
//
// Corre contra portal4_test_permisos_seguridad (derivada del MONGODB_URI del
// .env); se borra al final. No toca datos reales.
//
// Uso: npx ts-node scripts/test-permisos-seguridad.ts
import 'dotenv/config';

const TEST_DB = 'portal4_test_permisos_seguridad';
const TEST_PORT = 3911;
const BASE = `http://localhost:${TEST_PORT}/api/v1`;

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

let fallas = 0;
let vulnerabilidades = 0;

function check(ok: boolean, msg: string) {
  console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
  if (!ok) fallas++;
}

function alerta(condicionVulnerable: boolean, msg: string) {
  console.log(`  ${condicionVulnerable ? '🔓 VULNERABILIDAD:' : '✔ (bloqueado)'} ${msg}`);
  if (condicionVulnerable) vulnerabilidades++;
}

async function main() {
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';
  process.env.MONGODB_URI = uriConDb(baseUri, TEST_DB);
  process.env.PORT = String(TEST_PORT);
  process.env.CORS_ORIGIN = '*';
  console.log(`Base de datos de prueba: ${TEST_DB}`);
  console.log(`Servidor de prueba: ${BASE}\n`);

  const { NestFactory } = await import('@nestjs/core');
  const { ValidationPipe } = await import('@nestjs/common');
  const { Types } = await import('mongoose');
  const { getConnectionToken } = await import('@nestjs/mongoose');
  const { AppModule } = await import('../src/app.module');
  const { ParseObjectIdPipe } = await import('../src/common/pipes/parse-object-id.pipe');
  const bcrypt = await import('bcryptjs');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ParseObjectIdPipe(),
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableCors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  await app.listen(TEST_PORT);

  const conn: any = app.get(getConnectionToken());
  const db = conn.db;

  // ── Seed: 2 empresas, 3 centros, 5 usuarios (uno por rol/alcance) ─────────
  const oid = () => new Types.ObjectId();
  const empresaA = oid();
  const empresaB = oid();
  const centroA1 = oid();
  const centroA2 = oid();
  const centroB1 = oid();

  await db.collection('clientes').insertMany([
    { _id: empresaA, razon_social: 'Empresa A', rut: 'A-1', email_contacto: 'a@test.local', activo: true },
    { _id: empresaB, razon_social: 'Empresa B', rut: 'B-1', email_contacto: 'b@test.local', activo: true },
  ]);
  await db.collection('centros_costos').insertMany([
    { _id: centroA1, cliente_id: empresaA, codigo: 'A1', nombre: 'Centro A1', activo: true },
    { _id: centroA2, cliente_id: empresaA, codigo: 'A2', nombre: 'Centro A2', activo: true },
    { _id: centroB1, cliente_id: empresaB, codigo: 'B1', nombre: 'Centro B1', activo: true },
  ]);

  const pass = 'TestPass123!';
  const hash = await bcrypt.hash(pass, 10);
  const usuarios = {
    superAdmin: { _id: oid(), nombre: 'Super Admin', email: 'super@test.local', rol: 'super_admin' },
    adminSC: {
      _id: oid(), nombre: 'Admin SmartClarity', email: 'adminsc@test.local', rol: 'admin_smartclarity',
      permisos: { actividades: { crear: true, editar: true, eliminar: false } },
    },
    usuarioA1: {
      _id: oid(), nombre: 'Usuario A1', email: 'usuarioa1@test.local', rol: 'usuario',
      cliente_id: empresaA, centros_asignados: [centroA1],
      permisos: { docCentro: { subir: false }, actividades: { crear: true } },
    },
    usuarioA2: {
      _id: oid(), nombre: 'Usuario A2', email: 'usuarioa2@test.local', rol: 'usuario',
      cliente_id: empresaA, centros_asignados: [centroA2],
    },
    usuarioB1: { _id: oid(), nombre: 'Usuario B1', email: 'usuariob1@test.local', rol: 'usuario', cliente_id: empresaB },
  };
  await db.collection('usuarios').insertMany(
    Object.values(usuarios).map((u) => ({ ...u, password_hash: hash, activo: true, permiso_acceso: 'ver' })),
  );
  await db.collection('permisos').insertOne({
    usuario_id: usuarios.usuarioA1._id, centro_costo_id: centroA1, cliente_id: empresaA,
    tipo: 'ver', asignado_por: usuarios.superAdmin._id,
  });

  const tipoActividad = oid();
  await db.collection('tipos_actividad').insertOne({ _id: tipoActividad, nombre: 'Reunión', color: '#4E9AC7', icono: 'calendario' });
  const actividadParaBorrar = oid();
  await db.collection('actividades').insertOne({
    _id: actividadParaBorrar, nombre: 'Actividad de prueba', tipo_id: tipoActividad,
    centro_costo_id: centroA1, fecha: new Date(),
  });

  const tipoActivo = oid();
  await db.collection('tipos_activo').insertOne({ _id: tipoActivo, nombre: 'Caldera', color: '#0d9488', icono: 'caldera' });
  const activoA1 = oid();
  await db.collection('activos').insertOne({
    _id: activoA1, nombre: 'Caldera principal', tipo_activo_id: tipoActivo, centro_costo_id: centroA1, activo: true,
  });
  const docActivoA1 = oid();
  await db.collection('doc_activo').insertOne({
    _id: docActivoA1, activo_id: activoA1, nombre: 'manual.pdf', nombre_display: 'manual.pdf', tipo_contenido: 'archivo',
  });

  async function login(email: string): Promise<string> {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!res.ok) throw new Error(`login falló para ${email}: ${res.status} ${await res.text()}`);
    const body: any = await res.json();
    return body.access_token;
  }

  const tokens = {
    superAdmin: await login(usuarios.superAdmin.email),
    adminSC: await login(usuarios.adminSC.email),
    usuarioA1: await login(usuarios.usuarioA1.email),
    usuarioA2: await login(usuarios.usuarioA2.email),
    usuarioB1: await login(usuarios.usuarioB1.email),
  };

  async function req(method: string, path: string, token?: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* sin body */ }
    return { status: res.status, data };
  }

  // ── 1) JwtAuthGuard básico ──────────────────────────────────────────────
  console.log('1) Autenticación básica:');
  check((await req('GET', '/empresas')).status === 401, 'GET /empresas sin token → 401');
  check((await req('GET', '/empresas', 'token-invalido')).status === 401, 'GET /empresas con token inválido → 401');

  // ── 2) RolesGuard (@Roles) ──────────────────────────────────────────────
  console.log('\n2) RolesGuard — acciones restringidas por rol:');
  check(
    (await req('POST', `/empresas/${empresaA}/centros`, tokens.usuarioA1, { codigo: 'X', nombre: 'X' })).status === 403,
    'usuario NO puede crear centros de costo (solo admin) → 403',
  );
  check(
    (await req('POST', '/roles', tokens.adminSC, { nombre: 'Hack', permisos: {} })).status === 403,
    'admin_smartclarity NO puede crear roles (solo super_admin) → 403',
  );
  check(
    (await req('DELETE', `/empresas/${empresaA}`, tokens.adminSC)).status === 403,
    'admin_smartclarity NO puede eliminar una empresa (solo super_admin) → 403',
  );
  check(
    (await req('GET', '/usuarios', tokens.usuarioA1)).status === 403,
    'usuario NO puede listar todos los usuarios del sistema → 403',
  );
  check(
    (await req('GET', '/centros-costos', tokens.usuarioA1)).status === 403,
    'usuario NO puede listar centros de costo globales (todas las empresas) → 403',
  );
  const rolCreado = await req('POST', '/roles', tokens.superAdmin, { nombre: 'RolPruebaSeguridad', permisos: {} });
  check(rolCreado.status === 201 || rolCreado.status === 200, 'super_admin SÍ puede crear roles → 2xx');

  // ── 3) EmpresaAccessGuard — aislamiento entre empresas (tenants) ───────
  console.log('\n3) EmpresaAccessGuard — aislamiento entre empresas:');
  check(
    (await req('GET', `/empresas/${empresaA}/centros`, tokens.usuarioB1)).status === 403,
    'usuario de Empresa B NO puede listar centros de Empresa A → 403',
  );
  check(
    (await req('GET', `/empresas/${empresaB}/centros`, tokens.usuarioA1)).status === 403,
    'usuario de Empresa A NO puede listar centros de Empresa B → 403',
  );
  check(
    (await req('GET', `/empresas/${empresaB}/centros`, tokens.adminSC)).status === 200,
    'admin_smartclarity SÍ puede acceder a cualquier empresa → 200',
  );
  check(
    (await req('GET', `/empresas/${empresaA}/centros`, tokens.usuarioA1)).status === 200,
    'usuario A1 SÍ puede listar centros de su propia empresa → 200',
  );

  // ── 4) Fuga cross-tenant vía centroId (problema conocido, back4/CLAUDE.md §1.1) ─
  console.log('\n4) Fuga cross-tenant vía :centroId (problema documentado en CLAUDE.md):');
  {
    const r = await req('GET', `/empresas/${empresaA}/centros/${centroB1}`, tokens.usuarioA1);
    alerta(
      r.status === 200,
      `usuario A1, usando la ruta de SU empresa (${empresaA}) pero el ID del Centro B1 (de otra empresa), obtiene status ${r.status}` +
      (r.status === 200 ? ` y datos: ${JSON.stringify(r.data)}` : ''),
    );
  }
  {
    const r = await req('GET', `/empresas/${empresaA}/centros/${centroB1}/documentos`, tokens.usuarioA1);
    alerta(r.status === 200, `usuario A1 puede listar documentos del Centro B1 (otra empresa) vía ruta de su empresa → status ${r.status}`);
  }

  // ── 5) Alcance intra-empresa (centros_asignados / colección `permisos`) ─
  console.log('\n5) Alcance por centro dentro de la misma empresa (centros_asignados no filtra):');
  {
    const r = await req('GET', `/empresas/${empresaA}/centros`, tokens.usuarioA1);
    const ids = (r.data?.data ?? []).map((c: any) => c._id);
    alerta(
      ids.includes(String(centroA2)),
      `usuario A1 (asignado solo a Centro A1) ve Centro A2 en el listado de su empresa (${ids.length} centros devueltos, sin filtrar por centros_asignados)`,
    );
  }
  {
    const r = await req('GET', `/empresas/${empresaA}/centros/${centroA2}`, tokens.usuarioA1);
    alerta(r.status === 200, `usuario A1 puede pedir el detalle del Centro A2 directamente aunque no está en su centros_asignados → status ${r.status}`);
  }

  // ── 6) PermisosController — sin guards en absoluto ──────────────────────
  console.log('\n6) POST/GET/DELETE /permisos — endpoint sin @Roles():');
  {
    const r = await req('POST', '/permisos', tokens.usuarioA1, {
      usuario_id: String(usuarios.usuarioA1._id), centro_costo_id: String(centroA2), tipo: 'editar',
    });
    alerta(
      r.status === 200 || r.status === 201,
      `usuario A1 se auto-asigna permiso "editar" sobre Centro A2 (no asignado a él) sin ser admin → status ${r.status}`,
    );
  }
  {
    const r = await req('POST', '/permisos', tokens.usuarioA1, {
      usuario_id: String(usuarios.usuarioA1._id), centro_costo_id: String(centroB1), tipo: 'editar',
    });
    alerta(
      r.status === 200 || r.status === 201,
      `usuario A1 se auto-asigna permiso "editar" sobre Centro B1 (OTRA empresa) sin ser admin → status ${r.status}`,
    );
  }
  {
    const r = await req('GET', `/permisos/usuario/${usuarios.usuarioA2._id}`, tokens.usuarioA1);
    alerta(r.status === 200, `usuario A1 puede leer los permisos asignados a Usuario A2 (otra cuenta) → status ${r.status}`);
  }
  {
    const r = await req('DELETE', `/permisos/usuario/${usuarios.usuarioA2._id}/centro/${centroA2}`, tokens.usuarioA1);
    alerta(r.status === 200, `usuario A1 puede revocar un permiso ajeno (Usuario A2 sobre Centro A2) → status ${r.status}`);
  }

  // ── 7) Catálogo de permisos de acción (usuario.permisos) — PermisoAccionGuard,
  //      cableado a los guards desde 2026-08-12 (ya no es "fuera de alcance"). ──
  console.log('\n7) Permisos de acción por módulo (@RequiereAccion / PermisoAccionGuard):');
  {
    const form = new FormData();
    form.append('link_url', 'https://example.com/doc.pdf');
    form.append('nombre_display', 'Doc de prueba');
    const res = await fetch(`${BASE}/empresas/${empresaA}/centros/${centroA1}/documentos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.usuarioA1}` },
      body: form,
    });
    check(res.status === 403, `usuario A1 (permisos.docCentro.subir = false) NO puede subir un documento en Centro A1 → 403 (obtuvo ${res.status})`);
  }
  {
    // usuarioA1 no tiene rol admin y @Roles ya no restringe este endpoint — pero
    // sí tiene permisos.actividades.crear = true, así que debería poder igual.
    const r = await req('POST', `/empresas/${empresaA}/centros/${centroA1}/actividades`, tokens.usuarioA1, {
      nombre: 'Actividad creada por usuario con permiso', tipo_id: String(tipoActividad), fecha: new Date().toISOString(),
    });
    check(
      r.status === 200 || r.status === 201,
      `usuario A1 (rol 'usuario', permisos.actividades.crear = true) SÍ puede crear una actividad aunque su rol antes no lo permitía → esperado 2xx, obtuvo ${r.status}`,
    );
  }
  {
    // adminSC tiene rol admin_smartclarity (antes le alcanzaba por @Roles) pero
    // permisos.actividades.eliminar = false: ahora el permiso manda sobre el rol.
    const r = await req('DELETE', `/empresas/${empresaA}/centros/${centroA1}/actividades/${actividadParaBorrar}`, tokens.adminSC);
    check(
      r.status === 403,
      `admin_smartclarity con permisos.actividades.eliminar = false NO puede eliminar la actividad → esperado 403, obtuvo ${r.status}`,
    );
  }
  {
    // usuarioB1 no tiene objeto permisos en absoluto (default {}): debe quedar
    // bloqueado por default-deny, no por default-allow.
    const r = await req('POST', '/empresas', tokens.usuarioB1, { razon_social: 'Hack SA', rut: 'HACK-1', email_contacto: 'hack@test.local' });
    check(r.status === 403, `usuario B1 sin permisos.empresas.crear NO puede crear una empresa → esperado 403, obtuvo ${r.status}`);
  }
  {
    // Renombrar documento de activo se gobierna por
    // @RequiereAccion('docActivo', 'editarCategoria') (antes @Roles admin).
    // usuarioA2 no tiene permisos → cae al default del rol 'usuario', que
    // permite editarCategoria (el consumidor renombra sus documentos).
    const r = await req(
      'PATCH',
      `/empresas/${empresaA}/centros/${centroA1}/activos/${activoA1}/documentos/${docActivoA1}`,
      tokens.usuarioA2,
      { nombre_display: 'manual_v2.pdf' },
    );
    check(r.status === 200, `usuario sin permisos configurados renombra por default del rol → esperado 200, obtuvo ${r.status}`);
  }
  {
    // Una negación explícita SÍ debe bloquear: usuarioA2 con
    // docActivo.editarCategoria = false.
    await db.collection('usuarios').updateOne(
      { _id: usuarios.usuarioA2._id },
      { $set: { 'permisos.docActivo.editarCategoria': false } },
    );
    const r = await req(
      'PATCH',
      `/empresas/${empresaA}/centros/${centroA1}/activos/${activoA1}/documentos/${docActivoA1}`,
      tokens.usuarioA2,
      { nombre_display: 'manual_v3.pdf' },
    );
    check(r.status === 403, `usuario con docActivo.editarCategoria = false NO puede renombrar → esperado 403, obtuvo ${r.status}`);
  }
  {
    // usuarioA1 con docActivo.editarCategoria = true SÍ puede renombrar
    // (caso real del consumidor). El guard lee permisos desde la base en cada
    // request, así que basta actualizarlos en la DB sin re-login.
    await db.collection('usuarios').updateOne(
      { _id: usuarios.usuarioA1._id },
      { $set: { 'permisos.docActivo.editarCategoria': true } },
    );
    const r = await req(
      'PATCH',
      `/empresas/${empresaA}/centros/${centroA1}/activos/${activoA1}/documentos/${docActivoA1}`,
      tokens.usuarioA1,
      { nombre_display: 'manual_v4.pdf' },
    );
    check(
      r.status === 200,
      `usuario con permisos.docActivo.editarCategoria = true SÍ puede renombrar un documento de activo → esperado 200, obtuvo ${r.status}`,
    );
  }

  // ── 8) Usuarios nuevos no nacen bloqueados (permisosPorDefectoSegunRol) ──
  console.log('\n8) Un usuario admin_smartclarity creado recién puede operar sin configuración manual:');
  {
    const creado = await req('POST', '/usuarios', tokens.superAdmin, {
      nombre: 'Admin Nuevo', email: `admin-nuevo-${Date.now()}@test.local`, rol: 'admin_smartclarity',
    });
    check(creado.status === 200 || creado.status === 201, `POST /usuarios crea el admin nuevo → ${creado.status}`);
    const nuevoId = creado.data?._id;
    const usuarioDb = await db.collection('usuarios').findOne({ _id: new Types.ObjectId(nuevoId) });
    check(
      usuarioDb?.permisos?.centros?.crear === true,
      `el usuario admin_smartclarity recién creado ya tiene permisos.centros.crear = true sin tocar el modal (evita que nazca bloqueado)`,
    );
  }

  // ── 9) super_admin: acceso total de control ─────────────────────────────
  console.log('\n9) super_admin — control de acceso total (sanity check):');
  check(
    (await req('GET', `/empresas/${empresaB}/centros`, tokens.superAdmin)).status === 200,
    'super_admin accede a cualquier empresa → 200',
  );

  // ── Limpieza ─────────────────────────────────────────────────────────────
  await db.dropDatabase();
  await app.close();
  console.log(`\nBase ${TEST_DB} eliminada. Servidor de prueba detenido.`);

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Verificaciones de guards que fallaron (comportamiento inesperado): ${fallas}`);
  console.log(`Vulnerabilidades confirmadas (comportamiento inseguro pero "esperado" por el código actual): ${vulnerabilidades}`);

  if (fallas > 0) {
    console.error('\nHay guards que NO se comportan como se espera del código actual (revisar). Ver detalle arriba.');
    process.exit(1);
  }
  console.log('\nLos guards existentes (@Roles, EmpresaAccessGuard, JwtAuthGuard) funcionan como está previsto.');
  if (vulnerabilidades > 0) {
    console.log(`Se confirmaron ${vulnerabilidades} huecos de autorización reales — ver detalle arriba y el resumen entregado al usuario.`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
