/* Seed de roles base (presets de permisos) para portal-clientes-api.
   Crea "Administrador" (todos los permisos del catálogo en true) y "Usuario"
   (todos en false) si no existen. Es idempotente: si el rol ya existe por
   nombre, actualiza su objeto `permisos` en vez de duplicarlo.

   El catálogo de secciones/claves está duplicado aquí a propósito, en JS
   plano, porque el backend no valida el shape de `permisos` campo por campo
   (ver docs/superpowers/specs/2026-08-12-permisos-roles-usuarios-design.md) —
   la fuente de verdad real del catálogo vive en
   front4/src/app/shared/models/permisos.model.ts (PERM_SCHEMA). Si agregan
   una sección o clave ahí, actualicen también esta lista para que el rol
   "Administrador" siga representando "todos los permisos".

   Uso: node scripts/seed-roles.js
*/

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

const CATALOGO = {
  empresas: ['crear', 'editar', 'eliminar'],
  docEmpresa: ['subir', 'editarCategoria', 'vencer', 'eliminar'],
  centros: ['crear', 'editar', 'eliminar'],
  docCentro: ['subir', 'editarCategoria', 'vencer', 'eliminar'],
  proyectos: ['crear', 'editar', 'eliminar'],
  docProyecto: ['subir', 'editarCategoria', 'vencer', 'eliminar'],
  actividades: ['crear', 'editar', 'eliminar'],
  docActividad: ['subir', 'eliminar'],
  activos: ['crear', 'editar', 'eliminar'],
  docActivo: ['subir', 'eliminar'],
  catalogos: ['crear', 'editar', 'eliminar'],
  solicitudes: ['crear', 'cambiarEstado', 'eliminar'],
  usuarios: ['crear', 'editar', 'eliminar', 'crearAdmin'],
  noticias: ['crear', 'eliminar'],
};

function permisosCon(valor) {
  const permisos = {};
  for (const [seccion, claves] of Object.entries(CATALOGO)) {
    permisos[seccion] = {};
    for (const clave of claves) permisos[seccion][clave] = valor;
  }
  return permisos;
}

async function upsertRol(coll, nombre, permisos) {
  await coll.updateOne(
    { nombre },
    { $set: { nombre, permisos }, $setOnInsert: { creado_en: new Date() } },
    { upsert: true },
  );
}

async function main() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection;
  const coll = db.collection('roles');

  try {
    await upsertRol(coll, 'Administrador', permisosCon(true));
    console.log('✔ Rol "Administrador" (todos los permisos en true)');

    await upsertRol(coll, 'Usuario', permisosCon(false));
    console.log('✔ Rol "Usuario" (todos los permisos en false)');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
