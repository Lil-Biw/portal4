// Prueba E2E de la matriz de permisos del perfil consumidor (rol 'usuario')
// sobre CRUD de actividades. Levanta un servidor HTTP real (con todos los
// guards activos) contra una base de datos TEMPORAL y ejercita cada endpoint
// con tokens JWT reales, igual que lo haría un usuario desde el navegador.
//
// Cubre:
//  1. Consumidor SIN permisos configurados → default-deny (crear/editar/eliminar → 403,
//     flags puede_editar/puede_eliminar = false en el listado).
//  2. Consumidor con actividades.crear/editar/eliminar = true → crea y gestiona
//     sus propias actividades (flags true).
//  3. Actividades creadas por admins Eclarity → protegidas para el consumidor.
//  4. Actividades creadas por otro usuario de su misma empresa → editables por él.
//  5. Centros NO asignados → no puede crear (403), editar/eliminar (404).
//  6. Mover una actividad a un centro no asignado → bloqueado.
//  7. Consumidor con solo editar (sin crear/eliminar) → flags y 403 coherentes.
//  8. Documentos de actividad siguen la autoría de la actividad (perfil consumidor).
//  9. Aislamiento entre empresas.
//
// Corre contra portal4_test_permisos_actividad_consumidor (derivada del
// MONGODB_URI del .env); se borra al final. No toca datos reales.
//
// Uso: npx ts-node scripts/test-permisos-actividad-consumidor.ts
import 'dotenv/config';
import { Types } from 'mongoose';

const TEST_DB = 'portal4_test_permisos_actividad_consumidor';
const TEST_PORT = 3912;
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

function check(ok: boolean, msg: string) {
  console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
  if (!ok) fallas++;
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

  // ── Seed: 1 empresa con 2 centros (asignado / no asignado) + usuarios ────
  const oid = () => new Types.ObjectId();
  const empresaA = oid();
  const empresaB = oid();
  const centroAsig = oid();
  const centroNoAsig = oid();

  await db.collection('clientes').insertMany([
    { _id: empresaA, razon_social: 'Empresa A Actividades', rut: 'ACT-A', email_contacto: 'acta@test.local', activo: true },
    { _id: empresaB, razon_social: 'Empresa B Actividades', rut: 'ACT-B', email_contacto: 'actb@test.local', activo: true },
  ]);
  await db.collection('centros_costos').insertMany([
    { _id: centroAsig, cliente_id: empresaA, codigo: 'ASIG', nombre: 'Centro Asignado', activo: true },
    { _id: centroNoAsig, cliente_id: empresaA, codigo: 'NOASIG', nombre: 'Centro NO Asignado', activo: true },
  ]);

  const pass = 'TestPass123!';
  const hash = await bcrypt.hash(pass, 10);
  const usuarios = {
    super: { _id: oid(), nombre: 'Super Admin', email: 'act-super@test.local', rol: 'super_admin' },
    sinPerm: {
      _id: oid(), nombre: 'Consumidor sin permisos', email: 'act-sinperm@test.local', rol: 'usuario',
      cliente_id: empresaA, centros_asignados: [centroAsig],
    },
    total: {
      _id: oid(), nombre: 'Consumidor permisos completos', email: 'act-total@test.local', rol: 'usuario',
      cliente_id: empresaA, centros_asignados: [centroAsig],
      permisos: {
        actividades: { crear: true, editar: true, eliminar: true },
        docActividad: { subir: true, eliminar: true },
      },
    },
    soloEditar: {
      _id: oid(), nombre: 'Consumidor solo editar', email: 'act-soloeditar@test.local', rol: 'usuario',
      cliente_id: empresaA, centros_asignados: [centroAsig],
      permisos: { actividades: { crear: false, editar: true, eliminar: false } },
    },
    otraEmpresa: {
      _id: oid(), nombre: 'Consumidor otra empresa', email: 'act-otraemp@test.local', rol: 'usuario',
      cliente_id: empresaB, centros_asignados: [],
    },
  };
  await db.collection('usuarios').insertMany(
    Object.values(usuarios).map((u) => ({ ...u, password_hash: hash, activo: true, permiso_acceso: 'ver' })),
  );

  const tipoActividad = oid();
  await db.collection('tipos_actividad').insertOne({ _id: tipoActividad, nombre: 'Reunión', color: '#4E9AC7', icono: 'calendario' });

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
    super: await login(usuarios.super.email),
    sinPerm: await login(usuarios.sinPerm.email),
    total: await login(usuarios.total.email),
    soloEditar: await login(usuarios.soloEditar.email),
    otraEmpresa: await login(usuarios.otraEmpresa.email),
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

  const urlAct = (centro: Types.ObjectId, actId?: string) =>
    `/empresas/${empresaA}/centros/${centro}/actividades${actId ? `/${actId}` : ''}`;
  const cuerpoAct = (overrides: Record<string, unknown> = {}) => ({
    nombre: 'Actividad de prueba',
    tipo_id: String(tipoActividad),
    fecha: new Date(Date.now() + 86_400_000).toISOString(),
    notificacion: { notificar: false },
    ...overrides,
  });

  // Actividad "de admin" (la crea el super_admin): debe quedar protegida.
  const adminAct = await req('POST', urlAct(centroAsig), tokens.super, cuerpoAct());
  check(adminAct.status === 201 || adminAct.status === 200, `sanity: super_admin crea una actividad (setup) → ${adminAct.status}`);
  const adminActId: string = adminAct.data?._id ?? '';

  // ── 1) Consumidor SIN permisos → default-deny ────────────────────────────
  console.log('\n1) Consumidor SIN permisos configurados (defaults del rol):');
  {
    const r = await req('POST', urlAct(centroAsig), tokens.sinPerm, cuerpoAct());
    check(r.status === 403, `NO puede CREAR actividad → esperado 403, obtuvo ${r.status}`);
  }
  {
    const r = await req('PUT', urlAct(centroAsig, adminActId), tokens.sinPerm, { nombre: 'Hack edit' });
    check(r.status === 403, `NO puede EDITAR actividad → esperado 403, obtuvo ${r.status}`);
  }
  {
    const r = await req('DELETE', urlAct(centroAsig, adminActId), tokens.sinPerm);
    check(r.status === 403, `NO puede ELIMINAR actividad → esperado 403, obtuvo ${r.status}`);
  }
  {
    const r = await req('GET', `/empresas/${empresaA}/actividades`, tokens.sinPerm);
    const flags = (r.data ?? []).find((a: any) => a._id === adminActId);
    check(r.status === 200, `listado GET /empresas/:id/actividades → 200`);
    check(flags && flags.puede_editar === false && flags.puede_eliminar === false,
      `la actividad del admin aparece con puede_editar=false y puede_eliminar=false en el listado del consumidor`);
  }

  // ── 2) Consumidor con permisos completos → gestiona SUS actividades ──────
  console.log('\n2) Consumidor con actividades.crear/editar/eliminar = true:');
  const miAct = await req('POST', urlAct(centroAsig), tokens.total, cuerpoAct());
  check(miAct.status === 201 || miAct.status === 200, `SÍ puede CREAR actividad propia → ${miAct.status}`);
  const miActId: string = miAct.data?._id ?? '';
  check(!!miAct.data?.creado_por, `la actividad propia guarda creado_por (referencia al consumidor)`);
  {
    const r = await req('GET', `/empresas/${empresaA}/actividades`, tokens.total);
    const propias = (r.data ?? []).filter((a: any) => a._id === miActId);
    const adminF = (r.data ?? []).find((a: any) => a._id === adminActId);
    check(propias.length === 1 && propias[0].puede_editar === true && propias[0].puede_eliminar === true,
      `su propia actividad aparece con puede_editar=true y puede_eliminar=true`);
    check(adminF && adminF.puede_editar === false && adminF.puede_eliminar === false,
      `la actividad del admin sigue protegida en el mismo listado (false/false)`);
  }
  {
    const r = await req('PUT', urlAct(centroAsig, miActId), tokens.total, { nombre: 'Actividad editada por su creador' });
    check(r.status === 200, `SÍ puede EDITAR su propia actividad → esperado 200, obtuvo ${r.status}`);
  }
  {
    const r = await req('DELETE', urlAct(centroAsig, miActId), tokens.total);
    check(r.status === 200, `SÍ puede ELIMINAR su propia actividad → esperado 200, obtuvo ${r.status}`);
  }

  // ── 3) Actividad creada por admin Eclarity → protegida ───────────────────
  console.log('\n3) Actividad creada por un admin Eclarity (protegida):');
  {
    const r = await req('PUT', urlAct(centroAsig, adminActId), tokens.total, { nombre: 'Hack admin act' });
    check(r.status === 403, `NO puede EDITAR la actividad creada por admin → esperado 403, obtuvo ${r.status}`);
  }
  {
    const r = await req('DELETE', urlAct(centroAsig, adminActId), tokens.total);
    check(r.status === 403, `NO puede ELIMINAR la actividad creada por admin → esperado 403, obtuvo ${r.status}`);
  }

  // ── 4) Actividad creada por otro usuario de su misma empresa ─────────────
  console.log('\n4) Actividad creada por OTRO usuario de su misma empresa:');
  // La crea "total" y la edita/elimina "soloEditar": el creador es un usuario
  // (rol 'usuario') de su misma empresa → sí entra en "creador de su empresa".
  const actCompartida = await req('POST', urlAct(centroAsig), tokens.total, cuerpoAct({ nombre: 'Actividad compartida' }));
  const actCompartidaId: string = actCompartida.data?._id ?? '';
  {
    const r = await req('PUT', urlAct(centroAsig, actCompartidaId), tokens.soloEditar, { nombre: 'Editada por otro usuario de la empresa' });
    check(r.status === 200, `soloEditar SÍ puede EDITAR una actividad creada por otro usuario de SU empresa → esperado 200, obtuvo ${r.status}`);
  }
  {
    const r = await req('DELETE', urlAct(centroAsig, actCompartidaId), tokens.soloEditar);
    check(r.status === 403, `soloEditar NO puede ELIMINAR (permiso eliminar=false) → esperado 403, obtuvo ${r.status}`);
  }
  {
    const r = await req('GET', `/empresas/${empresaA}/actividades`, tokens.soloEditar);
    const f = (r.data ?? []).find((a: any) => a._id === actCompartidaId);
    check(f && f.puede_editar === true && f.puede_eliminar === false,
      `flags para soloEditar: puede_editar=true, puede_eliminar=false`);
  }
  {
    const r = await req('DELETE', urlAct(centroAsig, actCompartidaId), tokens.total);
    check(r.status === 200, `total SÍ puede ELIMINAR la actividad compartida (flags correctos) → esperado 200, obtuvo ${r.status}`);
  }

  // ── 5) Centro NO asignado ────────────────────────────────────────────────
  console.log('\n5) Centro de costos NO asignado al consumidor:');
  {
    // El create valida centros_asignados (autorizarCreacion): el consumidor NO
    // puede crear en un centro que no le corresponde gestionar.
    const r = await req('POST', urlAct(centroNoAsig), tokens.total, cuerpoAct({ nombre: 'Actividad en centro ajeno' }));
    check(r.status === 403, `NO puede CREAR en un centro que NO tiene asignado → esperado 403, obtuvo ${r.status}`);
    check(!r.data?._id, `no queda ninguna actividad creada en el centro no asignado`);
  }

  // ── 6) Mover una actividad a un centro NO asignado ───────────────────────
  console.log('\n6) Mover una actividad a un centro no asignado:');
  {
    const act = await req('POST', urlAct(centroAsig), tokens.total, cuerpoAct({ nombre: 'A mover' }));
    const id: string = act.data?._id ?? '';
    const r = await req('PUT', urlAct(centroAsig, id), tokens.total, { centro_costo_id: String(centroNoAsig) });
    check(r.status === 404 || r.status === 403,
      `mover a un centro NO asignado queda bloqueado → esperado 404/403, obtuvo ${r.status}`);
  }

  // ── 7) Consumidor con SOLO editar (sin crear ni eliminar) ────────────────
  console.log('\n7) Consumidor con solo actividades.editar (crear=false, eliminar=false):');
  {
    const r = await req('POST', urlAct(centroAsig), tokens.soloEditar, cuerpoAct());
    check(r.status === 403, `NO puede CREAR (crear=false) → esperado 403, obtuvo ${r.status}`);
  }
  {
    const act = await req('POST', urlAct(centroAsig), tokens.total, cuerpoAct({ nombre: 'Para soloEditar' }));
    const id: string = act.data?._id ?? '';
    const put = await req('PUT', urlAct(centroAsig, id), tokens.soloEditar, { nombre: 'editado' });
    check(put.status === 200, `soloEditar SÍ puede EDITAR una actividad de su empresa → esperado 200, obtuvo ${put.status}`);
  }

  // ── 8) Documentos de actividad siguen la autoría (perfil consumidor) ─────
  console.log('\n8) Documentos de actividad (subir/eliminar) siguen la autoría:');
  {
    const propia = await req('POST', urlAct(centroAsig), tokens.total, cuerpoAct({ nombre: 'Con documentos' }));
    const id: string = propia.data?._id ?? '';
    const form = new FormData();
    form.append('link_url', 'https://example.com/doc-propio.pdf');
    form.append('nombre_display', 'Doc de mi actividad');
    const subir = await fetch(`${BASE}${urlAct(centroAsig, id)}/documentos`, {
      method: 'POST', headers: { Authorization: `Bearer ${tokens.total}` }, body: form,
    });
    check(subir.status === 201 || subir.status === 200, `SÍ puede adjuntar un documento a SU actividad → ${subir.status}`);
    const docId = ((await subir.json() as any)?._id) ?? null;
    if (docId) {
      const del = await req('DELETE', `${urlAct(centroAsig, id)}/documentos/${docId}`, tokens.total);
      check(del.status === 200, `SÍ puede ELIMINAR el documento de SU actividad → esperado 200, obtuvo ${del.status}`);
    }
  }
  {
    // Con docActividad.subir=true pero sobre una actividad creada por un admin
    // Eclarity: la autorización de la actividad manda y lo bloquea.
    const form = new FormData();
    form.append('link_url', 'https://example.com/hack.pdf');
    const subir = await fetch(`${BASE}${urlAct(centroAsig, adminActId)}/documentos`, {
      method: 'POST', headers: { Authorization: `Bearer ${tokens.total}` }, body: form,
    });
    check(subir.status === 403, `NO puede adjuntar un documento a una actividad creada por admin → esperado 403, obtuvo ${subir.status}`);
  }

  // ── 9) Aislamiento entre empresas ────────────────────────────────────────
  console.log('\n9) Aislamiento entre empresas:');
  {
    const r = await req('GET', `/empresas/${empresaA}/actividades`, tokens.otraEmpresa);
    check(r.status === 403, `consumidor de Empresa B NO ve actividades de Empresa A → esperado 403, obtuvo ${r.status}`);
  }
  {
    const r = await req('POST', urlAct(centroAsig), tokens.otraEmpresa, cuerpoAct());
    check(r.status === 403, `consumidor de Empresa B NO puede crear en centros de Empresa A → esperado 403, obtuvo ${r.status}`);
  }

  // ── Limpieza ─────────────────────────────────────────────────────────────
  await db.dropDatabase();
  await app.close();
  console.log(`\nBase ${TEST_DB} eliminada. Servidor de prueba detenido.`);

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Verificaciones que fallaron (comportamiento inesperado): ${fallas}`);

  if (fallas > 0) {
    console.error('\nHay verificaciones que NO se comportan como espera el código actual (revisar).');
    process.exit(1);
  }
  console.log('\nLa matriz de permisos del consumidor funciona como está prevista.');
}

main().catch((err) => { console.error(err); process.exit(1); });
