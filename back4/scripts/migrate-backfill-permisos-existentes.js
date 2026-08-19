/* Backfill de `usuario.permisos` para cuentas admin_smartclarity/usuario que
   nunca pasaron por el modal "Permisos" (permisos vacío/ausente).

   Motivo: PermisoAccionGuard (2026-08-12) empezó a exigir permisos.<seccion>.<accion>
   en los endpoints de crear/editar/eliminar de cada módulo, reemplazando el viejo
   @Roles() en esos endpoints puntuales. Sin este backfill, cualquier cuenta con
   `permisos: {}` (el default del schema) queda bloqueada de golpe en TODO lo que
   antes hacía por su rol, aunque nadie le haya sacado nada a propósito.

   Este script rellena permisos.* con el equivalente EXACTO de lo que ese rol
   podía hacer antes del guard nuevo (no el preset "Administrador" completo,
   que le daría a admin_smartclarity cosas que nunca tuvo: crear/eliminar
   empresas, noticias, catálogos, o crear otro admin).

   Solo toca usuarios cuyo campo `permisos` está vacío o ausente — si un admin
   ya te sacó un permiso a mano (como en el caso que reportaste), este script
   no lo toca.

   Uso: node scripts/migrate-backfill-permisos-existentes.js
*/
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

// Lo que admin_smartclarity podía hacer vía @Roles antes de PermisoAccionGuard.
const PERMISOS_ADMIN_SMARTCLARITY = {
  empresas: { crear: false, editar: true, eliminar: false },
  docEmpresa: { subir: true, editarCategoria: true, vencer: true, eliminar: true },
  centros: { crear: true, editar: true, eliminar: true },
  docCentro: { subir: true, editarCategoria: true, vencer: true, eliminar: true },
  proyectos: { crear: true, editar: true, eliminar: true },
  docProyecto: { subir: true, editarCategoria: true, vencer: true, eliminar: true },
  actividades: { crear: true, editar: true, eliminar: true },
  docActividad: { subir: true, eliminar: true },
  activos: { crear: true, editar: true, eliminar: true },
  docActivo: { subir: true, editarCategoria: true, eliminar: true },
  catalogos: { crear: false, editar: false, eliminar: false },
  solicitudes: { crear: true, cambiarEstado: true, eliminar: true },
  usuarios: { crear: true, editar: true, eliminar: true, crearAdmin: false },
  noticias: { crear: false, eliminar: false },
};

// Lo que rol 'usuario' (cliente) podía hacer vía @Roles antes del guard nuevo.
const PERMISOS_USUARIO = {
  empresas: { crear: false, editar: false, eliminar: false },
  docEmpresa: { subir: true, editarCategoria: true, vencer: true, eliminar: false },
  centros: { crear: false, editar: false, eliminar: false },
  docCentro: { subir: true, editarCategoria: true, vencer: false, eliminar: true },
  proyectos: { crear: false, editar: false, eliminar: false },
  docProyecto: { subir: true, editarCategoria: true, vencer: false, eliminar: true },
  actividades: { crear: false, editar: false, eliminar: false },
  docActividad: { subir: false, eliminar: false },
  activos: { crear: false, editar: false, eliminar: false },
  docActivo: { subir: false, editarCategoria: true, eliminar: false },
  catalogos: { crear: false, editar: false, eliminar: false },
  solicitudes: { crear: false, cambiarEstado: false, eliminar: false },
  usuarios: { crear: false, editar: false, eliminar: false, crearAdmin: false },
  noticias: { crear: false, eliminar: false },
};

async function main() {
  await mongoose.connect(MONGO);
  const db = mongoose.connection.db;
  const coll = db.collection('usuarios');

  console.log(`Base: ${db.databaseName}`);

  for (const [rol, preset] of [['admin_smartclarity', PERMISOS_ADMIN_SMARTCLARITY], ['usuario', PERMISOS_USUARIO]]) {
    const candidatos = await coll.find({ rol, $or: [{ permisos: { $exists: false } }, { permisos: {} }] }).toArray();
    if (!candidatos.length) {
      console.log(`✔ ${rol}: sin cuentas con permisos vacío.`);
      continue;
    }
    for (const u of candidatos) {
      await coll.updateOne({ _id: u._id }, { $set: { permisos: preset } });
      console.log(`  ✔ ${rol} ${u.email}: permisos rellenados (equivalente a su acceso previo por rol)`);
    }
    console.log(`✔ ${rol}: ${candidatos.length} cuenta(s) actualizadas.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
