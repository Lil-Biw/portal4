/* Backfill de `usuario.permisos.docActivo.editarCategoria` para cuentas que ya
   tienen la sección `docActivo` configurada (pasaron por el modal "Permisos" o
   nacieron con permisos rellenados).

   Motivo: el endpoint PATCH .../activos/:activoId/documentos/:docId (renombrar
   documento) pasó de @Roles('super_admin','admin_smartclarity') a
   @RequiereAccion('docActivo', 'editarCategoria') para alinear activos con el
   resto de los módulos (empresa/centro/proyecto) y permitir que el consumidor
   renombre sus documentos. Sin este backfill, cualquier cuenta con permisos
   existentes que no tengan `editarCategoria` en `docActivo` quedaría bloqueada
   al renombrar, aunque antes renombrara por su rol (admin) o se espere que
   renombre (usuario).

   Sólo toca la sección `docActivo` de los permisos existentes: agrega
   `editarCategoria: true` y conserva el resto de los permisos tal cual
   (no toca lo que un admin haya quitado a mano en otras secciones).

   Uso: node scripts/migrate-backfill-docactivo-editar.js
*/
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

async function main() {
  await mongoose.connect(MONGO);
  const db = mongoose.connection.db;
  const coll = db.collection('usuarios');

  console.log(`Base: ${db.databaseName}`);

  const candidatos = await coll.find({
    permisos: { $type: 'object', $ne: {} },
    'permisos.docActivo': { $exists: true },
  }).toArray();

  if (!candidatos.length) {
    console.log('Sin cuentas con permisos.docActivo existente. Nada que hacer.');
    await mongoose.disconnect();
    return;
  }

  for (const u of candidatos) {
    const docActivo = u.permisos.docActivo ?? {};
    if (docActivo.editarCategoria === true) continue;
    await coll.updateOne(
      { _id: u._id },
      { $set: { 'permisos.docActivo.editarCategoria': true } },
    );
    console.log(`  ✔ ${u.rol} ${u.email}: docActivo.editarCategoria = true`);
  }

  console.log(`✔ ${candidatos.length} cuenta(s) revisada(s).`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
