// Ejecutar UNA sola vez antes de desplegar el backend con soporte multi-centro:
// node scripts/migrate-proyectos-multicentro.js
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB');

  const db = mongoose.connection.db;
  const proyectos = db.collection('proyectos');

  const docs = await proyectos.find({ centro_costo_id: { $exists: true } }).toArray();
  console.log(`Proyectos con centro_costo_id legacy: ${docs.length}`);

  if (docs.length > 0) {
    let actualizados = 0;
    for (const doc of docs) {
      await proyectos.updateOne(
        { _id: doc._id },
        { $set: { centro_costo_ids: [doc.centro_costo_id] }, $unset: { centro_costo_id: '' } }
      );
      actualizados++;
    }
    console.log(`Proyectos migrados: ${actualizados}`);
  } else {
    console.log('Nada que migrar en los documentos.');
  }

  const indices = await proyectos.indexes();
  const indiceViejo = indices.find(i => i.key && i.key.centro_costo_id === 1 && i.key.codigo === 1);
  if (indiceViejo) {
    await proyectos.dropIndex(indiceViejo.name);
    console.log(`Índice viejo eliminado: ${indiceViejo.name}`);
  } else {
    console.log('No se encontró el índice único viejo (centro_costo_id, codigo).');
  }

  console.log('\nMigración completa. El índice nuevo (centro_costo_ids, codigo) lo crea Mongoose automáticamente al levantar el backend.');
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
