// Ejecutar UNA sola vez antes de desplegar: node scripts/migrate-tipos-activo.js
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB');

  const db = mongoose.connection.db;
  const activos = db.collection('activos');
  const tiposActivo = db.collection('tipos_activo');

  // Obtener todos los activos con campo tipo_activo (legacy string)
  const docs = await activos.find({ tipo_activo: { $exists: true } }).toArray();
  console.log(`Activos con tipo_activo legacy: ${docs.length}`);

  if (docs.length === 0) {
    console.log('Nada que migrar.');
    await mongoose.disconnect();
    return;
  }

  // Crear mapa de nombre → ObjectId
  const nombreToId = new Map();
  const nombresUnicos = [...new Set(docs.map(d => d.tipo_activo))];

  for (const nombre of nombresUnicos) {
    const existente = await tiposActivo.findOne({ nombre });
    if (existente) {
      nombreToId.set(nombre, existente._id);
      console.log(`Tipo existente reutilizado: ${nombre}`);
    } else {
      const result = await tiposActivo.insertOne({ nombre, color: '#0095d6', creado_en: new Date(), actualizado_en: new Date() });
      nombreToId.set(nombre, result.insertedId);
      console.log(`Tipo creado: ${nombre}`);
    }
  }

  // Actualizar activos: añadir tipo_activo_id y eliminar tipo_activo
  let actualizados = 0;
  for (const doc of docs) {
    const tipoId = nombreToId.get(doc.tipo_activo);
    await activos.updateOne(
      { _id: doc._id },
      { $set: { tipo_activo_id: tipoId }, $unset: { tipo_activo: '' } }
    );
    actualizados++;
  }

  console.log(`\nMigración completa: ${actualizados} activos actualizados.`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
