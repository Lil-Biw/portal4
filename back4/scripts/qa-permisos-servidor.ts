// Seed de usuarios de PRUEBA persistentes + batería de permisos, corriendo
// contra el servidor real que ya tenés levantado (npm run start:dev, puerto
// 3000) y su base de datos real (la que apunta MONGODB_URI del .env, sin
// dbName en el URI → Mongo usa la base "test", que es la misma que usa tu
// servidor local). No crea un servidor nuevo ni borra nada existente.
//
// Todo lo creado por este script queda marcado con el prefijo "[QA] " en
// nombres/razón social y ruts que empiezan con "QA-", para poder ubicarlo y
// borrarlo fácil después (ver limpiarQaPermisos() al final del archivo, no se
// ejecuta sola).
//
// Uso:
//   npx ts-node scripts/qa-permisos-servidor.ts          # siembra + corre pruebas
//   npx ts-node scripts/qa-permisos-servidor.ts --solo-seed
//   npx ts-node scripts/qa-permisos-servidor.ts --limpiar   # borra todo lo [QA]
import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';
const BASE = 'http://localhost:3000/api/v1';
const PASSWORD = 'PruebaPermisos123!';
const MARCA = '[QA]';

async function conectar() {
  const conn = await mongoose.connect(MONGO);
  return conn.connection.db!;
}

async function limpiarQaPermisos(db: any) {
  const clientes = await db.collection('clientes').find({ razon_social: { $regex: `^\\${MARCA}` } }).toArray();
  const clienteIds = clientes.map((c: any) => c._id);
  const centros = await db.collection('centros_costos').find({ cliente_id: { $in: clienteIds } }).toArray();
  const centroIds = centros.map((c: any) => c._id);
  const usuarios = await db.collection('usuarios').find({ email: { $regex: '@qa-permisos\\.local$' } }).toArray();
  const usuarioIds = usuarios.map((u: any) => u._id);

  await db.collection('permisos').deleteMany({ $or: [{ usuario_id: { $in: usuarioIds } }, { centro_costo_id: { $in: centroIds } }] });
  await db.collection('usuarios').deleteMany({ _id: { $in: usuarioIds } });
  await db.collection('centros_costos').deleteMany({ _id: { $in: centroIds } });
  await db.collection('clientes').deleteMany({ _id: { $in: clienteIds } });

  console.log(`Limpieza: ${clientes.length} empresas, ${centros.length} centros, ${usuarios.length} usuarios QA eliminados.`);
}

async function sembrar(db: any) {
  const oid = () => new Types.ObjectId();
  const empresaA = oid();
  const empresaB = oid();
  const centroA1 = oid();
  const centroA2 = oid();
  const centroB1 = oid();

  await db.collection('clientes').insertMany([
    { _id: empresaA, razon_social: `${MARCA} Empresa A (pruebas permisos)`, rut: 'QA-A-' + Date.now(), email_contacto: 'qa-a@qa-permisos.local', activo: true, score_smartclarity: [5,5,5,5,5], mostrar_grafico_promedio: false },
    { _id: empresaB, razon_social: `${MARCA} Empresa B (pruebas permisos)`, rut: 'QA-B-' + Date.now(), email_contacto: 'qa-b@qa-permisos.local', activo: true, score_smartclarity: [5,5,5,5,5], mostrar_grafico_promedio: false },
  ]);
  await db.collection('centros_costos').insertMany([
    { _id: centroA1, cliente_id: empresaA, codigo: 'QA-A1', nombre: `${MARCA} Centro A1`, activo: true, score_smartclarity: [5,5,5,5,5] },
    { _id: centroA2, cliente_id: empresaA, codigo: 'QA-A2', nombre: `${MARCA} Centro A2`, activo: true, score_smartclarity: [5,5,5,5,5] },
    { _id: centroB1, cliente_id: empresaB, codigo: 'QA-B1', nombre: `${MARCA} Centro B1`, activo: true, score_smartclarity: [5,5,5,5,5] },
  ]);

  const hash = await bcrypt.hash(PASSWORD, 10);
  const usuarios = [
    { _id: oid(), nombre: `${MARCA} Super Admin`, email: 'superadmin@qa-permisos.local', rol: 'super_admin', permiso_acceso: 'editar' },
    { _id: oid(), nombre: `${MARCA} Admin SmartClarity`, email: 'adminsc@qa-permisos.local', rol: 'admin_smartclarity', permiso_acceso: 'editar' },
    { _id: oid(), nombre: `${MARCA} Usuario A1`, email: 'usuarioa1@qa-permisos.local', rol: 'usuario', cliente_id: empresaA, centros_asignados: [centroA1], permiso_acceso: 'ver' },
    { _id: oid(), nombre: `${MARCA} Usuario A2`, email: 'usuarioa2@qa-permisos.local', rol: 'usuario', cliente_id: empresaA, centros_asignados: [centroA2], permiso_acceso: 'ver' },
    { _id: oid(), nombre: `${MARCA} Usuario B1`, email: 'usuariob1@qa-permisos.local', rol: 'usuario', cliente_id: empresaB, centros_asignados: [centroB1], permiso_acceso: 'ver' },
  ];
  await db.collection('usuarios').insertMany(
    usuarios.map((u) => ({ ...u, password_hash: hash, activo: true, debe_cambiar_password: false, centros_asignados: u.centros_asignados ?? [], notificar_todas_empresas: false, empresas_suscritas: [], centros_suscritos: [], proyectos_suscritos: [] })),
  );

  return { empresaA, empresaB, centroA1, centroA2, centroB1, usuarios };
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
  const args = process.argv.slice(2);
  const db = await conectar();
  console.log(`Conectado a la base "${db.databaseName}" (misma que usa tu servidor local en :3000)\n`);

  if (args.includes('--limpiar')) {
    await limpiarQaPermisos(db);
    await mongoose.disconnect();
    return;
  }

  await limpiarQaPermisos(db); // por si quedó de una corrida anterior
  const seed = await sembrar(db);

  console.log('Usuarios de prueba creados (contraseña para todos: ' + PASSWORD + '):');
  console.log(`  super_admin        -> superadmin@qa-permisos.local`);
  console.log(`  admin_smartclarity -> adminsc@qa-permisos.local`);
  console.log(`  usuario (Emp.A/C1) -> usuarioa1@qa-permisos.local`);
  console.log(`  usuario (Emp.A/C2) -> usuarioa2@qa-permisos.local`);
  console.log(`  usuario (Emp.B/C1) -> usuariob1@qa-permisos.local`);
  console.log(`Podés loguearte con cualquiera de estos en http://localhost:4200\n`);

  if (args.includes('--solo-seed')) {
    await mongoose.disconnect();
    return;
  }

  async function login(email: string): Promise<string> {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (!res.ok) throw new Error(`login falló para ${email}: ${res.status} ${await res.text()}`);
    return (await res.json() as any).access_token;
  }

  console.log(`Corriendo pruebas contra el servidor real en ${BASE} ...\n`);
  const tokens = {
    superAdmin: await login('superadmin@qa-permisos.local'),
    adminSC: await login('adminsc@qa-permisos.local'),
    usuarioA1: await login('usuarioa1@qa-permisos.local'),
    usuarioA2: await login('usuarioa2@qa-permisos.local'),
    usuarioB1: await login('usuariob1@qa-permisos.local'),
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

  const { empresaA, empresaB, centroA1, centroA2, centroB1, usuarios } = seed;
  const usuarioA1Id = usuarios[2]._id;
  const usuarioA2Id = usuarios[3]._id;

  console.log('1) Autenticación básica:');
  check((await req('GET', '/empresas')).status === 401, 'GET /empresas sin token → 401');

  console.log('\n2) RolesGuard:');
  check((await req('POST', `/empresas/${empresaA}/centros`, tokens.usuarioA1, { codigo: 'X', nombre: 'X' })).status === 403, 'usuario NO puede crear centros → 403');
  check((await req('POST', '/roles', tokens.adminSC, { nombre: `${MARCA} Hack`, permisos: {} })).status === 403, 'admin_smartclarity NO puede crear roles → 403');
  check((await req('GET', '/usuarios', tokens.usuarioA1)).status === 403, 'usuario NO puede listar todos los usuarios → 403');

  console.log('\n3) EmpresaAccessGuard:');
  check((await req('GET', `/empresas/${empresaA}/centros`, tokens.usuarioB1)).status === 403, 'usuario de Empresa B NO ve centros de Empresa A → 403');
  check((await req('GET', `/empresas/${empresaB}/centros`, tokens.adminSC)).status === 200, 'admin_smartclarity accede a cualquier empresa → 200');

  console.log('\n4) Fuga cross-tenant vía :centroId:');
  {
    const r = await req('GET', `/empresas/${empresaA}/centros/${centroB1}`, tokens.usuarioA1);
    alerta(r.status === 200, `usuario A1 pide Centro B1 (otra empresa) vía ruta de su empresa → status ${r.status}`);
  }

  console.log('\n5) Alcance por centro dentro de la misma empresa:');
  {
    const r = await req('GET', `/empresas/${empresaA}/centros`, tokens.usuarioA1);
    const ids = (r.data?.data ?? []).map((c: any) => c._id);
    alerta(ids.includes(String(centroA2)), `usuario A1 (solo Centro A1) ve Centro A2 en el listado (${ids.length} centros devueltos)`);
  }
  {
    const r = await req('GET', `/empresas/${empresaA}/centros/${centroA2}`, tokens.usuarioA1);
    alerta(r.status === 200, `usuario A1 pide detalle de Centro A2 (no asignado) → status ${r.status}`);
  }

  console.log('\n6) /permisos sin guard de rol:');
  {
    const r = await req('POST', '/permisos', tokens.usuarioA1, { usuario_id: String(usuarioA1Id), centro_costo_id: String(centroA2), tipo: 'editar' });
    alerta(r.status === 200 || r.status === 201, `usuario A1 se auto-asigna "editar" sobre Centro A2 → status ${r.status}`);
  }
  {
    const r = await req('GET', `/permisos/usuario/${usuarioA2Id}`, tokens.usuarioA1);
    alerta(r.status === 200, `usuario A1 lee permisos de Usuario A2 (otra cuenta) → status ${r.status}`);
  }

  console.log('\n7) super_admin control total (sanity):');
  check((await req('GET', `/empresas/${empresaB}/centros`, tokens.superAdmin)).status === 200, 'super_admin accede a cualquier empresa → 200');

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Verificaciones que fallaron: ${fallas}`);
  console.log(`Vulnerabilidades confirmadas: ${vulnerabilidades}`);
  console.log('\nLos usuarios QA quedan en la base para que los pruebes a mano en http://localhost:4200.');
  console.log('Para borrarlos: npx ts-node scripts/qa-permisos-servidor.ts --limpiar');

  await mongoose.disconnect();
  if (fallas > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
