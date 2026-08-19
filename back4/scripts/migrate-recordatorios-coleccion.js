// Pensado para correr UNA vez tras desplegar el cambio que mueve los recordatorios
// de campos embebidos en Proyecto/Actividad a la colección dedicada `recordatorios`,
// pero es seguro re-ejecutarlo o correrlo tarde:
// node scripts/migrate-recordatorios-coleccion.js
//
// - Por cada proyecto con fecha_fin y cada actividad con fecha que TODAVÍA NO
//   tenga su doc espejo en `recordatorios`, lo crea (tipo, entidad_id, dias,
//   fecha_fin, ultimo_recordatorio_dias) leyendo el campo embebido legacy
//   dias_recordatorio (o el default [30, 15, 7, 3, 1, 0] si no lo tenía).
//   Si el doc en `recordatorios` YA existe (p. ej. porque la entidad se creó
//   o editó con el código nuevo entre el deploy y esta corrida), se deja
//   intacto — no se sobreescribe con el default.
// - Limpia dias_recordatorio/ultimo_recordatorio_dias de proyectos/actividades.
// - Limpia los campos por-usuario ya obsoletos de un diseño previo
//   (dias_recordatorio_proyecto / dias_recordatorio_actividad).
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';
const DIAS_DEFAULT = [30, 15, 7, 3, 1, 0];

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB');

  const db = mongoose.connection.db;

  // No pisar documentos que el código nuevo ya haya creado en `recordatorios`
  // (p. ej. un proyecto/actividad creado o editado entre el deploy y esta
  // corrida): esos ya no tienen `dias_recordatorio` embebido, así que caerían
  // en el default [30,15,7,3,1,0] y se perdería la selección real del usuario.
  // Solo se inserta si NO existe ya un doc para ese tipo/entidad.
  const proyectos = await db.collection('proyectos')
    .find({ fecha_fin: { $ne: null } })
    .project({ dias_recordatorio: 1, ultimo_recordatorio_dias: 1, fecha_fin: 1 })
    .toArray();
  let proyectosMigrados = 0;
  for (const p of proyectos) {
    const existente = await db.collection('recordatorios')
      .findOne({ tipo: 'proyecto', entidad_id: p._id }, { projection: { _id: 1 } });
    if (existente) continue;
    await db.collection('recordatorios').insertOne({
      tipo: 'proyecto',
      entidad_id: p._id,
      dias: p.dias_recordatorio ?? DIAS_DEFAULT,
      fecha_fin: p.fecha_fin,
      ...(p.ultimo_recordatorio_dias !== undefined ? { ultimo_recordatorio_dias: p.ultimo_recordatorio_dias } : {}),
    });
    proyectosMigrados++;
  }
  console.log(`recordatorios: ${proyectosMigrados}/${proyectos.length} proyecto(s) migrado(s) (el resto ya tenía doc propio)`);

  const actividades = await db.collection('actividades')
    .find({ fecha: { $ne: null } })
    .project({ dias_recordatorio: 1, ultimo_recordatorio_dias: 1, fecha: 1, fecha_termino: 1 })
    .toArray();
  let actividadesMigradas = 0;
  for (const a of actividades) {
    const existente = await db.collection('recordatorios')
      .findOne({ tipo: 'actividad', entidad_id: a._id }, { projection: { _id: 1 } });
    if (existente) continue;
    await db.collection('recordatorios').insertOne({
      tipo: 'actividad',
      entidad_id: a._id,
      dias: a.dias_recordatorio ?? DIAS_DEFAULT,
      fecha_fin: a.fecha_termino ?? a.fecha,
      ...(a.ultimo_recordatorio_dias !== undefined ? { ultimo_recordatorio_dias: a.ultimo_recordatorio_dias } : {}),
    });
    actividadesMigradas++;
  }
  console.log(`recordatorios: ${actividadesMigradas}/${actividades.length} actividad(es) migrada(s) (el resto ya tenía doc propio)`);

  for (const coleccion of ['proyectos', 'actividades']) {
    const res = await db.collection(coleccion).updateMany(
      {},
      { $unset: { dias_recordatorio: '', ultimo_recordatorio_dias: '' } },
    );
    console.log(`${coleccion}: ${res.modifiedCount} documento(s) limpiados de los campos embebidos`);
  }

  const resUsuarios = await db.collection('usuarios').updateMany(
    {
      $or: [
        { dias_recordatorio_proyecto: { $exists: true } },
        { dias_recordatorio_actividad: { $exists: true } },
      ],
    },
    { $unset: { dias_recordatorio_proyecto: '', dias_recordatorio_actividad: '' } },
  );
  console.log(`usuarios: ${resUsuarios.modifiedCount} documento(s) limpiados de los campos por-usuario`);

  console.log('\nMigración completa.');
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
