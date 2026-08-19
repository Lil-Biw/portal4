// Ejecutar UNA sola vez tras desplegar el nuevo flujo de 7 estados de Proyecto:
// node scripts/migrate-estados-proyecto.js
//
// Mapeo del esquema viejo (borrador/planificacion/activo/en_pausa/en_revision/
// cerrado/cancelado) al nuevo (estancado/nuevo_sin_oc/nuevo_con_oc/en_ejecucion/
// cierre_pendiente/finalizado_facturar/finalizado_facturado + el sentinel interno
// 'eliminado' para soft-delete). 'cerrado' y 'cancelado' se overloadeaban en el
// código viejo tanto para "eliminado por un admin" (ProyectosService.remove) como
// para "vencido y cerrado automáticamente" (enviarRecordatoriosVencimiento) — no
// se puede distinguir un caso del otro desde los datos, así que se migran a
// 'eliminado' (mismo comportamiento de antes: quedan fuera de los listados por
// defecto, exactamente como ya pasaba con 'cerrado').
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

const MAPA_ESTADOS = {
  borrador: 'nuevo_sin_oc',
  planificacion: 'nuevo_con_oc',
  activo: 'en_ejecucion',
  en_pausa: 'estancado',
  en_revision: 'cierre_pendiente',
  cerrado: 'eliminado',
  cancelado: 'eliminado',
};

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB');

  const db = mongoose.connection.db;
  const proyectos = db.collection('proyectos');

  let totalMigrados = 0;
  for (const [viejo, nuevo] of Object.entries(MAPA_ESTADOS)) {
    const res = await proyectos.updateMany({ estado: viejo }, { $set: { estado: nuevo } });
    if (res.modifiedCount > 0) {
      console.log(`estado '${viejo}' -> '${nuevo}': ${res.modifiedCount} proyecto(s)`);
      totalMigrados += res.modifiedCount;
    }
  }

  console.log(totalMigrados > 0 ? `\nMigración completa: ${totalMigrados} proyecto(s) actualizados.` : '\nNada que migrar.');
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
