/* Seed de datos simulados para portal-clientes-api
   Inserta al menos 5 documentos de cada concepto: clientes, usuarios,
   centros_costos, tipos_proyecto, proyectos, tipos_activo, activos,
   tipos_actividad, actividades, recordatorios, solicitudes, permisos,
   noticias, documentos_vencidos y los documentos por entidad (doc_cliente,
   doc_centro_costo, doc_proyecto, doc_actividad, doc_activo). Estos
   últimos son solo metadata con un s3_key ficticio — no se sube ningún
   archivo real a S3, por lo que descargarlos desde la app fallará.

   Las fechas de actividades/proyectos/documentos_vencidos se calculan en
   relación al momento en que se corre el script (ver HOY/addDays), no están
   fijas — así los datos siguen viéndose vigentes sin importar cuándo se
   re-siembre, y algunos proyectos/actividades quedan con dias_recordatorio
   configurado (colección recordatorios) para poder probar los avisos de
   vencimiento sin esperar a que el cron real los haya generado.

   Cada documento usa un _id determinístico (derivado de una etiqueta fija
   con MD5) en vez de dejar que Mongo lo autogenere. Así las referencias
   entre colecciones (cliente_id, centro_costo_id, etc.) no cambian entre
   corridas y el script puede re-ejecutarse las veces que sea necesario sin
   duplicar ni dejar registros huérfanos: cada sección borra por _id antes
   de insertar.

   Uso: node scripts/seed-demo-data.js
*/

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Usa la misma MONGODB_URI que el backend (definida en .env). Si no está
// definida, cae al mismo default que src/app.module.ts.
const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';
const DEMO_PASSWORD = 'Demo1234!';

function fixedId(label) {
  return new mongoose.Types.ObjectId(crypto.createHash('md5').update(label).digest('hex').slice(0, 24));
}

// Fechas relativas al momento en que se corre el script (no fijas), para que
// el dev server siempre muestre actividades/proyectos "vigentes" sin importar
// cuándo se re-siembre. addDays negativo = pasado.
const HOY = new Date();
function addDays(n) {
  const d = new Date(HOY);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

async function seedCollection(coll, docs) {
  await coll.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
  await coll.insertMany(docs);
}

async function main() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection;

  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // ---------------------------------------------------------------
    // 1) Clientes (5)
    // ---------------------------------------------------------------
    const mineraId = fixedId('cliente:minera-andina');
    const agroId = fixedId('cliente:agrosur');
    const transporteId = fixedId('cliente:transportes-pacifico');
    const constructoraId = fixedId('cliente:constructora-cordillera');
    const energiaId = fixedId('cliente:energia-renovable-sur');

    const clientesData = [
      {
        _id: mineraId,
        razon_social: 'Minera Andina S.A.',
        rut: '76.111.222-3',
        email_contacto: 'contacto@mineraandina.cl',
        telefono: '+56222001001',
        direccion: { calle: 'Av. Apoquindo 4500', ciudad: 'Santiago', region: 'RM', pais: 'Chile' },
        activo: true,
        score_smartclarity: [4, 5, 4, 5, 4],
        mostrar_grafico_promedio: true,
      },
      {
        _id: agroId,
        razon_social: 'AgroSur Ltda.',
        rut: '76.222.333-4',
        email_contacto: 'contacto@agrosur.cl',
        telefono: '+56222001002',
        direccion: { calle: 'Camino Real 890', ciudad: 'Talca', region: 'Maule', pais: 'Chile' },
        activo: true,
        score_smartclarity: [5, 5, 5, 4, 5],
        mostrar_grafico_promedio: true,
      },
      {
        _id: transporteId,
        razon_social: 'Transportes del Pacífico SpA',
        rut: '76.333.444-5',
        email_contacto: 'contacto@transpacifico.cl',
        telefono: '+56222001003',
        direccion: { calle: 'Av. Argentina 1200', ciudad: 'Valparaíso', region: 'Valparaíso', pais: 'Chile' },
        activo: true,
        score_smartclarity: [3, 4, 4, 3, 4],
        mostrar_grafico_promedio: false,
      },
      {
        _id: constructoraId,
        razon_social: 'Constructora Cordillera S.A.',
        rut: '76.444.555-6',
        email_contacto: 'contacto@cordillera.cl',
        telefono: '+56222001004',
        direccion: { calle: 'Av. Vitacura 3200', ciudad: 'Santiago', region: 'RM', pais: 'Chile' },
        activo: true,
        score_smartclarity: [4, 4, 5, 5, 4],
        mostrar_grafico_promedio: true,
      },
      {
        _id: energiaId,
        razon_social: 'Energía Renovable del Sur SpA',
        rut: '76.555.666-7',
        email_contacto: 'contacto@energiarenovablesur.cl',
        telefono: '+56222001005',
        direccion: { calle: 'Ruta 5 Sur Km 850', ciudad: 'Puerto Montt', region: 'Los Lagos', pais: 'Chile' },
        activo: true,
        score_smartclarity: [5, 4, 4, 4, 5],
        mostrar_grafico_promedio: false,
      },
    ];
    await seedCollection(db.collection('clientes'), clientesData);

    // ---------------------------------------------------------------
    // 2) Usuarios (6)
    // ---------------------------------------------------------------
    const superAdminId = fixedId('usuario:superadmin');
    const adminMineraId = fixedId('usuario:carla-munoz');
    const userAgroId = fixedId('usuario:jose-perez');
    const userTransporteId = fixedId('usuario:marcela-soto');
    const userConstructoraId = fixedId('usuario:rodrigo-fuentes');
    const userEnergiaId = fixedId('usuario:valentina-rojas');

    const usuariosData = [
      {
        _id: superAdminId,
        nombre: 'Andrés Root',
        email: 'superadmin@eclariti.local',
        password_hash: passwordHash,
        rol: 'super_admin',
        permiso_acceso: 'editar',
        centros_asignados: [],
        debe_cambiar_password: false,
        activo: true,
      },
      {
        _id: adminMineraId,
        cliente_id: mineraId,
        nombre: 'Carla Muñoz',
        email: 'carla.munoz@mineraandina.cl',
        password_hash: passwordHash,
        rol: 'admin_smartclarity',
        permiso_acceso: 'editar',
        centros_asignados: [],
        debe_cambiar_password: false,
        activo: true,
      },
      {
        _id: userAgroId,
        cliente_id: agroId,
        nombre: 'José Pérez',
        email: 'jose.perez@agrosur.cl',
        password_hash: passwordHash,
        rol: 'usuario',
        permiso_acceso: 'editar',
        centros_asignados: [],
        debe_cambiar_password: false,
        activo: true,
      },
      {
        _id: userTransporteId,
        cliente_id: transporteId,
        nombre: 'Marcela Soto',
        email: 'marcela.soto@transpacifico.cl',
        password_hash: passwordHash,
        rol: 'usuario',
        permiso_acceso: 'ver',
        centros_asignados: [],
        debe_cambiar_password: true,
        activo: true,
      },
      {
        _id: userConstructoraId,
        cliente_id: constructoraId,
        nombre: 'Rodrigo Fuentes',
        email: 'rodrigo.fuentes@cordillera.cl',
        password_hash: passwordHash,
        rol: 'usuario',
        permiso_acceso: 'editar',
        centros_asignados: [],
        debe_cambiar_password: false,
        activo: true,
      },
      {
        _id: userEnergiaId,
        cliente_id: energiaId,
        nombre: 'Valentina Rojas',
        email: 'valentina.rojas@energiarenovablesur.cl',
        password_hash: passwordHash,
        rol: 'usuario',
        permiso_acceso: 'ver',
        centros_asignados: [],
        debe_cambiar_password: false,
        activo: true,
      },
    ];
    await seedCollection(db.collection('usuarios'), usuariosData);

    // ---------------------------------------------------------------
    // 3) Centros de costos (7 — AgroSur tiene 3: Fundo, Packing y Vivero)
    // ---------------------------------------------------------------
    const centroCobreId = fixedId('centro:faena-el-cobre');
    const centroAndesId = fixedId('centro:faena-los-andes');
    const centroFundoId = fixedId('centro:fundo-san-rafael');
    const centroTerminalId = fixedId('centro:terminal-valparaiso');
    const centroObraId = fixedId('centro:obra-edificio-cordillera');
    const centroPackingId = fixedId('centro:packing-la-esperanza');
    const centroViveroId = fixedId('centro:vivero-los-nogales');

    const centrosData = [
      {
        _id: centroCobreId,
        cliente_id: mineraId,
        codigo: 'CC-001',
        nombre: 'Faena El Cobre',
        descripcion: 'Faena principal de extracción de cobre',
        ubicacion_ciudad: 'Calama',
        ubicacion_region: 'Antofagasta',
        ubicacion_pais: 'Chile',
        activo: true,
        score_smartclarity: [4, 5, 4, 4, 5],
      },
      {
        _id: centroAndesId,
        cliente_id: mineraId,
        codigo: 'CC-002',
        nombre: 'Faena Los Andes',
        descripcion: 'Faena secundaria de procesamiento',
        ubicacion_ciudad: 'Los Andes',
        ubicacion_region: 'Valparaíso',
        ubicacion_pais: 'Chile',
        activo: true,
        score_smartclarity: [3, 4, 4, 4, 4],
      },
      {
        _id: centroFundoId,
        cliente_id: agroId,
        codigo: 'CC-001',
        nombre: 'Fundo San Rafael',
        descripcion: 'Fundo agrícola de producción frutícola',
        ubicacion_ciudad: 'Talca',
        ubicacion_region: 'Maule',
        ubicacion_pais: 'Chile',
        activo: true,
        score_smartclarity: [5, 5, 5, 5, 4],
      },
      {
        _id: centroTerminalId,
        cliente_id: transporteId,
        codigo: 'CC-001',
        nombre: 'Terminal Valparaíso',
        descripcion: 'Terminal de carga y logística portuaria',
        ubicacion_ciudad: 'Valparaíso',
        ubicacion_region: 'Valparaíso',
        ubicacion_pais: 'Chile',
        activo: true,
        score_smartclarity: [3, 3, 4, 3, 4],
      },
      {
        _id: centroObraId,
        cliente_id: constructoraId,
        codigo: 'CC-001',
        nombre: 'Obra Edificio Cordillera',
        descripcion: 'Obra de construcción edificio residencial',
        ubicacion_ciudad: 'Santiago',
        ubicacion_region: 'RM',
        ubicacion_pais: 'Chile',
        activo: true,
        score_smartclarity: [4, 4, 5, 4, 4],
      },
      {
        _id: centroPackingId,
        cliente_id: agroId,
        codigo: 'CC-002',
        nombre: 'Packing La Esperanza',
        descripcion: 'Planta de embalaje y packing de fruta de exportación',
        ubicacion_ciudad: 'Talca',
        ubicacion_region: 'Maule',
        ubicacion_pais: 'Chile',
        activo: true,
        score_smartclarity: [4, 4, 5, 4, 5],
      },
      {
        _id: centroViveroId,
        cliente_id: agroId,
        codigo: 'CC-003',
        nombre: 'Vivero Los Nogales',
        descripcion: 'Vivero de propagación de plantas frutales',
        ubicacion_ciudad: 'San Clemente',
        ubicacion_region: 'Maule',
        ubicacion_pais: 'Chile',
        activo: true,
        score_smartclarity: [5, 4, 4, 5, 4],
      },
    ];
    await seedCollection(db.collection('centros_costos'), centrosData);

    // ---------------------------------------------------------------
    // 4) Tipos de proyecto — catálogo oficial ECLARITI (A–K)
    // ---------------------------------------------------------------
    const tipoIotId    = fixedId('tipo-proyecto:iot-eclariti');
    const tipoIngId    = fixedId('tipo-proyecto:ingenieria-auditorias');
    const tipoObraId   = fixedId('tipo-proyecto:construccion-obras-nuevas');
    const tipoNormId   = fixedId('tipo-proyecto:normalizacion-instalaciones');
    const tipoBancoId  = fixedId('tipo-proyecto:mantencion-bancos-condensadores');
    const tipoEquipoId = fixedId('tipo-proyecto:mantencion-otros-equipos');
    const tipoContrId  = fixedId('tipo-proyecto:contratos-mantencion-integral');
    const tipoSgeId    = fixedId('tipo-proyecto:sistemas-gestion-energia');
    const tipoBneId    = fixedId('tipo-proyecto:balance-nacional-energia');
    const tipoVentaId  = fixedId('tipo-proyecto:venta-equipos-suministro');
    const tipoCapacitacionId = fixedId('tipo-proyecto:capacitacion-entrenamiento');

    const tiposProyectoData = [
      { _id: tipoIotId,    nombre: 'A. IOT – ECLARITI',                             color: '#0095d6' },
      { _id: tipoIngId,    nombre: 'B. INGENIERÍA Y AUDITORÍAS',                    color: '#ae3ec9' },
      { _id: tipoObraId,   nombre: 'C. CONSTRUCCIÓN DE OBRAS NUEVAS',               color: '#e8590c' },
      { _id: tipoNormId,   nombre: 'D. NORMALIZACIÓN DE INSTALACIONES EXISTENTES',  color: '#f08c00' },
      { _id: tipoBancoId,  nombre: 'E. MANTENCIÓN DE BANCOS DE CONDENSADORES',      color: '#2f9e44' },
      { _id: tipoEquipoId, nombre: 'F. MANTENCIÓN DE OTROS EQUIPOS ELÉCTRICOS',     color: '#12b886' },
      { _id: tipoContrId,  nombre: 'G. CONTRATOS DE MANTENCIÓN INTEGRAL',           color: '#1971c2' },
      { _id: tipoSgeId,    nombre: 'H. SISTEMAS DE GESTIÓN DE LA ENERGÍA (SGE)',    color: '#7048e8' },
      { _id: tipoBneId,    nombre: 'I. BALANCE NACIONAL DE ENERGÍA (BNE)',          color: '#c92a2a' },
      { _id: tipoVentaId,  nombre: 'J. VENTA DE EQUIPOS – SOLO SUMINISTRO',         color: '#495057' },
      { _id: tipoCapacitacionId, nombre: 'K. CAPACITACIÓN Y ENTRENAMIENTO',         color: '#d6336c' },
    ];
    // Catálogo cerrado: elimina cualquier tipo que no esté en la lista A–K
    // (incluye los antiguos Mantenimiento/Construcción/Ampliación/Auditoría/Certificación).
    await db.collection('tipos_proyecto').deleteMany({ _id: { $nin: tiposProyectoData.map((d) => d._id) } });
    await seedCollection(db.collection('tipos_proyecto'), tiposProyectoData);

    // ---------------------------------------------------------------
    // 5) Proyectos (8 — AgroSur tiene 4: Fundo x2, Packing y Vivero)
    // ---------------------------------------------------------------
    const proyAmplId = fixedId('proyecto:ampliacion-el-cobre');
    const proyMantId = fixedId('proyecto:mantenimiento-los-andes');
    const proyCertId = fixedId('proyecto:certificacion-fundo-san-rafael');
    const proyModId = fixedId('proyecto:modernizacion-terminal-valparaiso');
    const proyConstId = fixedId('proyecto:construccion-torre-b-cordillera');
    const proySgeFundoId = fixedId('proyecto:sge-fundo-san-rafael');
    const proyNormPackingId = fixedId('proyecto:normalizacion-packing-esperanza');
    const proyCapViveroId = fixedId('proyecto:capacitacion-vivero-nogales');

    // dias_recordatorio no vive en el documento de Proyecto (colección aparte
    // `recordatorios`, ver sección 5b más abajo) — se guarda acá junto a cada
    // proyecto solo para no repetir la lista al construir esa colección.
    const proyectosData = [
      {
        _id: proyAmplId,
        centro_costo_ids: [centroCobreId],
        cliente_id: mineraId,
        tipo_proyecto_id: tipoIotId,
        codigo: 'PRJ-001',
        nombre: 'Monitoreo IoT Planta El Cobre',
        descripcion: 'Instalación de sensores IoT Eclariti para monitoreo energético en tiempo real',
        estado: 'en_ejecucion',
        fecha_inicio: addDays(-190),
        fecha_fin: addDays(60),
        dias_recordatorio: [30, 15, 7],
        creado_por: adminMineraId,
      },
      {
        _id: proyMantId,
        // Contrato de mantención integral que cubre ambas faenas de la minera.
        centro_costo_ids: [centroCobreId, centroAndesId],
        cliente_id: mineraId,
        tipo_proyecto_id: tipoContrId,
        codigo: 'PRJ-002',
        nombre: 'Mantención Integral Los Andes',
        descripcion: 'Contrato anual de mantención integral de equipos eléctricos',
        estado: 'nuevo_con_oc',
        fecha_inicio: addDays(15),
        fecha_fin: addDays(380),
        creado_por: adminMineraId,
      },
      {
        _id: proyCertId,
        centro_costo_ids: [centroFundoId],
        cliente_id: agroId,
        tipo_proyecto_id: tipoIngId,
        codigo: 'PRJ-001',
        nombre: 'Auditoría Energética Fundo San Rafael',
        descripcion: 'Auditoría energética de instalaciones y sistemas de riego',
        estado: 'cierre_pendiente',
        fecha_inicio: addDays(-70),
        fecha_fin: addDays(5),
        dias_recordatorio: [7, 3, 1],
        creado_por: userAgroId,
      },
      {
        _id: proyModId,
        centro_costo_ids: [centroTerminalId],
        cliente_id: transporteId,
        tipo_proyecto_id: tipoNormId,
        codigo: 'PRJ-001',
        nombre: 'Normalización Eléctrica Terminal Valparaíso',
        descripcion: 'Normalización de instalaciones eléctricas y sistemas de carga del terminal',
        estado: 'nuevo_sin_oc',
        creado_por: userTransporteId,
      },
      {
        _id: proyConstId,
        centro_costo_ids: [centroObraId],
        cliente_id: constructoraId,
        tipo_proyecto_id: tipoObraId,
        codigo: 'PRJ-001',
        nombre: 'Construcción Torre B Cordillera',
        descripcion: 'Construcción de segunda torre del proyecto habitacional',
        estado: 'finalizado_facturar',
        fecha_inicio: addDays(-410),
        fecha_fin: addDays(-10),
        creado_por: userConstructoraId,
      },
      {
        _id: proySgeFundoId,
        centro_costo_ids: [centroFundoId],
        cliente_id: agroId,
        tipo_proyecto_id: tipoSgeId,
        codigo: 'PRJ-002',
        nombre: 'Sistema de Gestión de la Energía AgroSur',
        descripcion: 'Implementación de SGE para monitoreo del consumo eléctrico del riego',
        estado: 'estancado',
        fecha_inicio: addDays(45),
        creado_por: userAgroId,
      },
      {
        _id: proyNormPackingId,
        centro_costo_ids: [centroPackingId],
        cliente_id: agroId,
        tipo_proyecto_id: tipoNormId,
        codigo: 'PRJ-001',
        nombre: 'Normalización Eléctrica Packing La Esperanza',
        descripcion: 'Normalización de tableros e instalaciones eléctricas de la planta de packing',
        estado: 'en_ejecucion',
        fecha_inicio: addDays(-90),
        fecha_fin: addDays(1),
        dias_recordatorio: [7, 3, 1, 0],
        // Ya se avisó en el umbral de 3 días; el próximo cron debería notificar
        // el umbral de 1 (queda simulado "a punto de dispararse").
        ultimo_recordatorio_dias: 3,
        creado_por: userAgroId,
      },
      {
        _id: proyCapViveroId,
        centro_costo_ids: [centroViveroId],
        cliente_id: agroId,
        tipo_proyecto_id: tipoCapacitacionId,
        codigo: 'PRJ-001',
        nombre: 'Capacitación en Eficiencia Energética Vivero Los Nogales',
        descripcion: 'Capacitación al personal del vivero sobre uso eficiente de energía',
        estado: 'finalizado_facturado',
        creado_por: userAgroId,
      },
    ];
    await seedCollection(
      db.collection('proyectos'),
      // dias_recordatorio/ultimo_recordatorio_dias no son campos del schema de
      // Proyecto (viven en `recordatorios`) — se quitan acá antes de insertar.
      proyectosData.map(({ dias_recordatorio, ultimo_recordatorio_dias, ...p }) => p),
    );

    // ---------------------------------------------------------------
    // 6) Tipos de activo (5)
    // ---------------------------------------------------------------
    const tipoVehiculoId = fixedId('tipo-activo:vehiculo');
    const tipoMaqId = fixedId('tipo-activo:maquinaria-pesada');
    const tipoElecId = fixedId('tipo-activo:equipo-electrico');
    const tipoHerrId = fixedId('tipo-activo:herramienta');
    const tipoInfraId = fixedId('tipo-activo:infraestructura');

    const tiposActivoData = [
      { _id: tipoVehiculoId, nombre: 'Vehículo', color: '#1971c2' },
      { _id: tipoMaqId, nombre: 'Maquinaria Pesada', color: '#e8590c' },
      { _id: tipoElecId, nombre: 'Equipo Eléctrico', color: '#f08c00' },
      { _id: tipoHerrId, nombre: 'Herramienta', color: '#495057' },
      { _id: tipoInfraId, nombre: 'Infraestructura', color: '#2f9e44' },
    ];
    await seedCollection(db.collection('tipos_activo'), tiposActivoData);

    // ---------------------------------------------------------------
    // 7) Activos (8 — AgroSur tiene 4: Generador, Bomba, Cámara y Tractor)
    // ---------------------------------------------------------------
    const activoCamionId = fixedId('activo:camion-tolva-01');
    const activoExcavId = fixedId('activo:excavadora-cat-320');
    const activoGenId = fixedId('activo:generador-diesel-100kva');
    const activoGruaId = fixedId('activo:grua-horquilla');
    const activoAndamioId = fixedId('activo:andamio-modular');
    const activoBombaId = fixedId('activo:bomba-riego-solar');
    const activoCamaraId = fixedId('activo:camara-frio-packing');
    const activoTractorId = fixedId('activo:tractor-new-holland');

    const activosData = [
      {
        _id: activoCamionId,
        nombre: 'Camión Tolva 01',
        tipo_activo_id: tipoVehiculoId,
        centro_costo_id: centroCobreId,
        descripcion: 'Camión tolva para transporte de mineral',
        activo: true,
      },
      {
        _id: activoExcavId,
        nombre: 'Excavadora CAT 320',
        tipo_activo_id: tipoMaqId,
        centro_costo_id: centroAndesId,
        descripcion: 'Excavadora hidráulica para movimiento de tierra',
        activo: true,
      },
      {
        _id: activoGenId,
        nombre: 'Generador Diésel 100kVA',
        tipo_activo_id: tipoElecId,
        centro_costo_id: centroFundoId,
        descripcion: 'Generador de respaldo para sistema de riego',
        activo: true,
      },
      {
        _id: activoGruaId,
        nombre: 'Grúa Horquilla',
        tipo_activo_id: tipoVehiculoId,
        centro_costo_id: centroTerminalId,
        descripcion: 'Grúa horquilla para carga y descarga de contenedores',
        activo: true,
      },
      {
        _id: activoAndamioId,
        nombre: 'Andamio Modular',
        tipo_activo_id: tipoInfraId,
        centro_costo_id: centroObraId,
        descripcion: 'Andamio modular certificado para obra en altura',
        activo: true,
      },
      {
        _id: activoBombaId,
        nombre: 'Bomba de Riego Solar',
        tipo_activo_id: tipoElecId,
        centro_costo_id: centroFundoId,
        descripcion: 'Bomba de riego alimentada con paneles fotovoltaicos',
        activo: true,
      },
      {
        _id: activoCamaraId,
        nombre: 'Cámara de Frío Packing',
        tipo_activo_id: tipoElecId,
        centro_costo_id: centroPackingId,
        descripcion: 'Cámara de frío para conservación de fruta antes de exportación',
        activo: true,
      },
      {
        _id: activoTractorId,
        nombre: 'Tractor Agrícola New Holland',
        tipo_activo_id: tipoVehiculoId,
        centro_costo_id: centroViveroId,
        descripcion: 'Tractor agrícola para labores de propagación en el vivero',
        activo: true,
      },
    ];
    await seedCollection(db.collection('activos'), activosData);

    // ---------------------------------------------------------------
    // 8) Tipos de actividad (5)
    // ---------------------------------------------------------------
    const tipoInspId = fixedId('tipo-actividad:inspeccion');
    const tipoCorrId = fixedId('tipo-actividad:mantenimiento-correctivo');
    const tipoPrevId = fixedId('tipo-actividad:mantenimiento-preventivo');
    const tipoCapId = fixedId('tipo-actividad:capacitacion');
    const tipoAudSegId = fixedId('tipo-actividad:auditoria-seguridad');

    // Colores alineados a la paleta suave de COLORES_ACTIVIDAD
    // (front4/src/app/features/actividades/actividades-icons.ts) — no usar los
    // tonos saturados antiguos, el picker de la UI ya no los ofrece.
    const tiposActividadData = [
      { _id: tipoInspId, nombre: 'Inspección', color: '#4E9AC7', descripcion: 'Revisión periódica de estado' },
      { _id: tipoCorrId, nombre: 'Mantenimiento Correctivo', color: '#D46A63', descripcion: 'Reparación ante falla' },
      { _id: tipoPrevId, nombre: 'Mantenimiento Preventivo', color: '#5FAE7B', descripcion: 'Mantenimiento programado' },
      { _id: tipoCapId, nombre: 'Capacitación', color: '#D9A24B', descripcion: 'Capacitación a personal' },
      { _id: tipoAudSegId, nombre: 'Auditoría de Seguridad', color: '#9B85C9', descripcion: 'Auditoría de cumplimiento normativo' },
    ];
    await seedCollection(db.collection('tipos_actividad'), tiposActividadData);

    // ---------------------------------------------------------------
    // 9) Actividades (8 — AgroSur tiene 4: Capacitación, Inspección, Mantención y Auditoría)
    // ---------------------------------------------------------------
    const actInspeccionId = fixedId('actividad:inspeccion-mensual-camiones');
    const actCorrectivaId = fixedId('actividad:mantenimiento-correctivo-excavadora');
    const actCapacitacionId = fixedId('actividad:capacitacion-uso-generador');
    const actPreventivaId = fixedId('actividad:mantenimiento-preventivo-grua');
    const actAuditoriaId = fixedId('actividad:auditoria-seguridad-obra');
    const actInspBombaId = fixedId('actividad:inspeccion-bomba-riego');
    const actMantCamaraId = fixedId('actividad:mantenimiento-camara-frio');
    const actAudViveroId = fixedId('actividad:auditoria-seguridad-vivero');

    // dias_recordatorio no vive en el documento de Actividad (colección aparte
    // `recordatorios`, ver sección 5b) — se guarda acá junto a cada actividad
    // solo para no repetir la lista al construir esa colección.
    const actividadesData = [
      {
        _id: actInspeccionId,
        nombre: 'Inspección mensual camiones tolva',
        descripcion: 'Revisión de frenos, neumáticos y niveles',
        tipo_id: tipoInspId,
        centro_costo_id: centroCobreId,
        activo_ids: [activoCamionId],
        fecha: addDays(-10),
        hora: '08:00',
      },
      {
        _id: actCorrectivaId,
        nombre: 'Mantenimiento correctivo excavadora',
        descripcion: 'Reparación de sistema hidráulico',
        tipo_id: tipoCorrId,
        centro_costo_id: centroAndesId,
        activo_ids: [activoExcavId],
        fecha: addDays(-5),
      },
      {
        _id: actCapacitacionId,
        nombre: 'Capacitación uso de generador',
        descripcion: 'Capacitación a operarios sobre uso seguro',
        tipo_id: tipoCapId,
        centro_costo_id: centroFundoId,
        activo_ids: [activoGenId],
        fecha: addDays(3),
        hora: '09:00',
        hora_termino: '12:00',
        dias_recordatorio: [7, 3, 1],
      },
      {
        _id: actPreventivaId,
        nombre: 'Mantenimiento preventivo grúa horquilla',
        descripcion: 'Cambio de aceite y revisión de mástil',
        tipo_id: tipoPrevId,
        centro_costo_id: centroTerminalId,
        activo_ids: [activoGruaId],
        fecha: addDays(10),
        dias_recordatorio: [7, 3, 1, 0],
      },
      {
        _id: actAuditoriaId,
        nombre: 'Auditoría de seguridad en obra',
        descripcion: 'Revisión de arnés, andamios y protocolos',
        tipo_id: tipoAudSegId,
        centro_costo_id: centroObraId,
        activo_ids: [activoAndamioId],
        fecha: addDays(1),
        hora: '08:30',
        dias_recordatorio: [7, 3, 1, 0],
        // Ya se avisó en el umbral de 3 días; el próximo cron debería notificar
        // el umbral de 1 (queda simulado "a punto de dispararse").
        ultimo_recordatorio_dias: 3,
      },
      {
        _id: actInspBombaId,
        nombre: 'Inspección bomba de riego solar',
        descripcion: 'Revisión de paneles, inversor y caudal de bombeo',
        tipo_id: tipoInspId,
        centro_costo_id: centroFundoId,
        activo_ids: [activoBombaId],
        fecha: addDays(20),
        dias_recordatorio: [15, 7],
      },
      {
        _id: actMantCamaraId,
        nombre: 'Mantenimiento preventivo cámara de frío',
        descripcion: 'Revisión de compresores y control de temperatura',
        tipo_id: tipoPrevId,
        centro_costo_id: centroPackingId,
        activo_ids: [activoCamaraId],
        fecha: addDays(-15),
      },
      {
        _id: actAudViveroId,
        nombre: 'Auditoría de seguridad en vivero',
        descripcion: 'Revisión de protocolos de uso del tractor y maquinaria menor',
        tipo_id: tipoAudSegId,
        centro_costo_id: centroViveroId,
        activo_ids: [activoTractorId],
        fecha: addDays(30),
        dias_recordatorio: [30, 15, 7, 3, 1, 0],
      },
    ];
    await seedCollection(
      db.collection('actividades'),
      // dias_recordatorio/ultimo_recordatorio_dias no son campos del schema de
      // Actividad (viven en `recordatorios`) — se quitan acá antes de insertar.
      actividadesData.map(({ dias_recordatorio, ultimo_recordatorio_dias, ...a }) => a),
    );

    // ---------------------------------------------------------------
    // 9b) Recordatorios — colección `recordatorios` (espejo de dias/fecha_fin
    // por proyecto/actividad; mismo shape que arma RecordatoriosService.sincronizar)
    // ---------------------------------------------------------------
    const recordatoriosData = [];
    for (const p of proyectosData) {
      if (!p.dias_recordatorio?.length || !p.fecha_fin) continue;
      recordatoriosData.push({
        _id: fixedId(`recordatorio:proyecto:${p._id}`),
        tipo: 'proyecto',
        entidad_id: p._id,
        dias: p.dias_recordatorio,
        fecha_fin: p.fecha_fin,
        ...(p.ultimo_recordatorio_dias !== undefined ? { ultimo_recordatorio_dias: p.ultimo_recordatorio_dias } : {}),
      });
    }
    for (const a of actividadesData) {
      if (!a.dias_recordatorio?.length) continue;
      recordatoriosData.push({
        _id: fixedId(`recordatorio:actividad:${a._id}`),
        tipo: 'actividad',
        entidad_id: a._id,
        dias: a.dias_recordatorio,
        fecha_fin: a.fecha,
        ...(a.ultimo_recordatorio_dias !== undefined ? { ultimo_recordatorio_dias: a.ultimo_recordatorio_dias } : {}),
      });
    }
    // No usa seedCollection: recordatorios ya podría tener un doc previo para
    // esta misma entidad con un _id distinto (generado por RecordatoriosService
    // en una corrida real de la app, no por este script), y el índice único es
    // sobre {tipo, entidad_id} — hay que limpiar por esa clave, no por _id.
    await db.collection('recordatorios').deleteMany({ entidad_id: { $in: recordatoriosData.map((r) => r.entidad_id) } });
    await db.collection('recordatorios').insertMany(recordatoriosData);

    // ---------------------------------------------------------------
    // 10) Solicitudes (5)
    // ---------------------------------------------------------------
    const solicitudesData = [
      {
        _id: fixedId('solicitud:aumento-presupuesto-ampliacion'),
        nombre: 'Aumento de presupuesto monitoreo IoT',
        tipo: 'presupuesto',
        descripcion: 'Solicitud de aumento de presupuesto para compra de sensores adicionales',
        empresa_id: mineraId,
        centro_costo_id: centroCobreId,
        proyecto_id: proyAmplId,
        estado: 'pendiente',
      },
      {
        _id: fixedId('solicitud:cambio-alcance-certificacion'),
        nombre: 'Cambio de alcance auditoría',
        tipo: 'cambio_alcance',
        descripcion: 'Ampliar alcance de la auditoría energética a nuevas instalaciones',
        empresa_id: agroId,
        centro_costo_id: centroFundoId,
        proyecto_id: proyCertId,
        estado: 'revision',
      },
      {
        _id: fixedId('solicitud:nuevo-epp-terminal'),
        nombre: 'Solicitud de nuevo EPP',
        tipo: 'insumos',
        descripcion: 'Solicitud de equipo de protección personal para operarios de terminal',
        empresa_id: transporteId,
        centro_costo_id: centroTerminalId,
        estado: 'aprobado',
      },
      {
        _id: fixedId('solicitud:extension-plazo-torre-b'),
        nombre: 'Extensión de plazo obra Torre B',
        tipo: 'plazo',
        descripcion: 'Solicitud de extensión de plazo por retraso en suministro de materiales',
        empresa_id: constructoraId,
        centro_costo_id: centroObraId,
        proyecto_id: proyConstId,
        estado: 'rechazado',
        motivo_rechazo: 'El plazo actual aún tiene holgura suficiente según el cronograma vigente',
      },
      {
        _id: fixedId('solicitud:certificado-ambiental-solar'),
        nombre: 'Certificado ambiental planta solar',
        tipo: 'certificacion',
        descripcion: 'Solicitud de certificado de cumplimiento ambiental',
        empresa_id: energiaId,
        estado: 'pendiente',
      },
    ];
    await seedCollection(db.collection('solicitudes'), solicitudesData);

    // ---------------------------------------------------------------
    // 11) Permisos (5)
    // ---------------------------------------------------------------
    const permisosData = [
      {
        _id: fixedId('permiso:transporte-ver-terminal'),
        usuario_id: userTransporteId,
        centro_costo_id: centroTerminalId,
        cliente_id: transporteId,
        tipo: 'ver',
        asignado_por: superAdminId,
      },
      {
        _id: fixedId('permiso:constructora-editar-obra'),
        usuario_id: userConstructoraId,
        centro_costo_id: centroObraId,
        cliente_id: constructoraId,
        tipo: 'editar',
        asignado_por: superAdminId,
      },
      {
        _id: fixedId('permiso:agro-editar-fundo'),
        usuario_id: userAgroId,
        centro_costo_id: centroFundoId,
        cliente_id: agroId,
        tipo: 'editar',
        asignado_por: superAdminId,
      },
      {
        _id: fixedId('permiso:minera-editar-cobre'),
        usuario_id: adminMineraId,
        centro_costo_id: centroCobreId,
        cliente_id: mineraId,
        tipo: 'editar',
        asignado_por: superAdminId,
      },
      {
        _id: fixedId('permiso:minera-ver-andes'),
        usuario_id: adminMineraId,
        centro_costo_id: centroAndesId,
        cliente_id: mineraId,
        tipo: 'ver',
        asignado_por: superAdminId,
      },
    ];
    await seedCollection(db.collection('permisos'), permisosData);

    // ---------------------------------------------------------------
    // 12) Noticias (5)
    // ---------------------------------------------------------------
    const noticiasData = [
      {
        _id: fixedId('noticia:nueva-version-portal'),
        titulo: 'Nueva versión del Portal de Clientes',
        enlace: 'https://eclariti.cl/noticias/nueva-version-portal',
        resumen: 'Mejoras de rendimiento y nueva sección de actividades por centro de costos.',
        seccion: 'novedades',
        imagen_url: '',
        imagen_data: null,
        imagen_mimetype: '',
        activo: true,
      },
      {
        _id: fixedId('noticia:actualizacion-ds-43'),
        titulo: 'Actualización normativa DS 43',
        enlace: 'https://eclariti.cl/noticias/actualizacion-ds-43',
        resumen: 'Cambios en el reglamento de almacenamiento de sustancias peligrosas.',
        seccion: 'normativas',
        imagen_url: '',
        imagen_data: null,
        imagen_mimetype: '',
        activo: true,
      },
      {
        _id: fixedId('noticia:mantenimiento-programado'),
        titulo: 'Mantenimiento programado de la plataforma',
        enlace: 'https://eclariti.cl/noticias/mantenimiento-programado',
        resumen: 'La plataforma no estará disponible el próximo sábado entre 02:00 y 04:00 hrs.',
        seccion: 'anuncios',
        imagen_url: '',
        imagen_data: null,
        imagen_mimetype: '',
        activo: true,
      },
      {
        _id: fixedId('noticia:modulo-actividades'),
        titulo: 'Lanzamiento del módulo de actividades',
        enlace: 'https://eclariti.cl/noticias/modulo-actividades',
        resumen: 'Ahora puedes registrar actividades y asociarlas a activos por centro de costos.',
        seccion: 'novedades',
        imagen_url: '',
        imagen_data: null,
        imagen_mimetype: '',
        activo: true,
      },
      {
        _id: fixedId('noticia:ley-proteccion-datos'),
        titulo: 'Nueva ley de protección de datos personales',
        enlace: 'https://eclariti.cl/noticias/ley-proteccion-datos',
        resumen: 'Resumen de los principales cambios y su impacto en el manejo de documentos.',
        seccion: 'normativas',
        imagen_url: '',
        imagen_data: null,
        imagen_mimetype: '',
        activo: true,
      },
    ];
    await seedCollection(db.collection('noticias'), noticiasData);

    // ---------------------------------------------------------------
    // 13) Documentos vencidos (5)
    // ---------------------------------------------------------------
    const docsVencidosData = [
      {
        _id: fixedId('doc-vencido:iso-9001-minera'),
        nombre_display: 'Certificado ISO 9001 2024.pdf',
        categoria: 'certificaciones',
        tipo_mime: 'application/pdf',
        tamano_bytes: 245000,
        origen_tipo: 'empresa',
        empresa_id: mineraId,
        empresa_nombre: 'Minera Andina S.A.',
        subido_por: adminMineraId,
        subido_en: addDays(-380),
        vencido_en: addDays(-15),
      },
      {
        _id: fixedId('doc-vencido:poliza-seguro-fundo'),
        nombre_display: 'Poliza Seguro Fundo 2025.pdf',
        categoria: 'seguros',
        tipo_mime: 'application/pdf',
        tamano_bytes: 189000,
        origen_tipo: 'centro',
        empresa_id: agroId,
        centro_id: centroFundoId,
        empresa_nombre: 'AgroSur Ltda.',
        centro_nombre: 'Fundo San Rafael',
        subido_por: userAgroId,
        subido_en: addDays(-370),
        vencido_en: addDays(-6),
      },
      {
        _id: fixedId('doc-vencido:permiso-circulacion-terminal'),
        nombre_display: 'Permiso Circulacion Terminal.pdf',
        categoria: 'permisos',
        tipo_mime: 'application/pdf',
        tamano_bytes: 98000,
        origen_tipo: 'centro',
        empresa_id: transporteId,
        centro_id: centroTerminalId,
        empresa_nombre: 'Transportes del Pacífico SpA',
        centro_nombre: 'Terminal Valparaíso',
        subido_por: userTransporteId,
        subido_en: addDays(-365),
        vencido_en: addDays(-2),
      },
      {
        _id: fixedId('doc-vencido:aprobacion-ambiental-torre-b'),
        nombre_display: 'Aprobacion Ambiental Torre B.pdf',
        categoria: 'ambiental',
        tipo_mime: 'application/pdf',
        tamano_bytes: 312000,
        origen_tipo: 'proyecto',
        empresa_id: constructoraId,
        proyecto_id: proyConstId,
        empresa_nombre: 'Constructora Cordillera S.A.',
        proyecto_nombre: 'Construcción Torre B Cordillera',
        subido_por: userConstructoraId,
        subido_en: addDays(-395),
        vencido_en: addDays(-30),
      },
      {
        _id: fixedId('doc-vencido:certificado-conexion-electrica'),
        nombre_display: 'Certificado Conexion Electrica.pdf',
        categoria: 'certificaciones',
        tipo_mime: 'application/pdf',
        tamano_bytes: 156000,
        origen_tipo: 'empresa',
        empresa_id: energiaId,
        empresa_nombre: 'Energía Renovable del Sur SpA',
        subido_por: userEnergiaId,
        subido_en: addDays(-360),
        vencido_en: addDays(-1),
      },
    ];
    await seedCollection(db.collection('documentos_vencidos'), docsVencidosData);

    // ---------------------------------------------------------------
    // 14) Documentos de clientes (5) — doc_cliente
    // ---------------------------------------------------------------
    const s3Key = (origenTipo, entidadId, nombreArchivo) =>
      `documentos/${origenTipo}/${entidadId}/demo_${nombreArchivo}`;

    const docClienteData = [
      {
        _id: fixedId('doc-cliente:escritura-minera'),
        cliente_id: mineraId,
        nombre: 'escritura_constitucion_minera_andina.pdf',
        nombre_display: 'Escritura Constitución Minera Andina.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 210000,
        s3_key: s3Key('empresa', mineraId, 'escritura_constitucion_minera_andina.pdf'),
        categoria: 'legal',
        subido_por: adminMineraId,
        subido_en: new Date('2025-01-05'),
      },
      {
        _id: fixedId('doc-cliente:certificado-sag-agrosur'),
        cliente_id: agroId,
        nombre: 'certificado_sag_agrosur.pdf',
        nombre_display: 'Certificado SAG AgroSur.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 145000,
        s3_key: s3Key('empresa', agroId, 'certificado_sag_agrosur.pdf'),
        categoria: 'certificaciones',
        subido_por: userAgroId,
        subido_en: new Date('2025-02-10'),
      },
      {
        _id: fixedId('doc-cliente:patente-transportes'),
        cliente_id: transporteId,
        nombre: 'patente_comercial_transportes.pdf',
        nombre_display: 'Patente Comercial Transportes.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 98000,
        s3_key: s3Key('empresa', transporteId, 'patente_comercial_transportes.pdf'),
        categoria: 'legal',
        subido_por: userTransporteId,
        subido_en: new Date('2025-03-01'),
      },
      {
        _id: fixedId('doc-cliente:registro-contratista-cordillera'),
        cliente_id: constructoraId,
        nombre: 'registro_contratista_dom.pdf',
        nombre_display: 'Registro Contratista DOM.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 176000,
        s3_key: s3Key('empresa', constructoraId, 'registro_contratista_dom.pdf'),
        categoria: 'certificaciones',
        subido_por: userConstructoraId,
        subido_en: new Date('2025-03-20'),
      },
      {
        _id: fixedId('doc-cliente:concesion-electrica-ers'),
        cliente_id: energiaId,
        nombre: 'concesion_electrica_ers.pdf',
        nombre_display: 'Concesión Eléctrica ERS.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 203000,
        s3_key: s3Key('empresa', energiaId, 'concesion_electrica_ers.pdf'),
        categoria: 'legal',
        subido_por: userEnergiaId,
        subido_en: new Date('2025-04-15'),
      },
    ];
    await seedCollection(db.collection('doc_cliente'), docClienteData);

    // ---------------------------------------------------------------
    // 15) Documentos de centros de costos (5) — doc_centro_costo
    // ---------------------------------------------------------------
    const docCentroCostoData = [
      {
        _id: fixedId('doc-centro:plano-el-cobre'),
        centro_costo_id: centroCobreId,
        nombre: 'plano_faena_el_cobre.pdf',
        nombre_display: 'Plano Faena El Cobre.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 512000,
        s3_key: s3Key('centro', centroCobreId, 'plano_faena_el_cobre.pdf'),
        categoria: 'planos',
        subido_por: adminMineraId,
        subido_en: new Date('2025-01-12'),
      },
      {
        _id: fixedId('doc-centro:informe-ambiental-los-andes'),
        centro_costo_id: centroAndesId,
        nombre: 'informe_ambiental_los_andes.pdf',
        nombre_display: 'Informe Ambiental Los Andes.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 267000,
        s3_key: s3Key('centro', centroAndesId, 'informe_ambiental_los_andes.pdf'),
        categoria: 'ambiental',
        subido_por: adminMineraId,
        subido_en: new Date('2025-02-05'),
      },
      {
        _id: fixedId('doc-centro:certificado-riego-fundo'),
        centro_costo_id: centroFundoId,
        nombre: 'certificado_riego_fundo.pdf',
        nombre_display: 'Certificado Riego Fundo.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 132000,
        s3_key: s3Key('centro', centroFundoId, 'certificado_riego_fundo.pdf'),
        categoria: 'certificaciones',
        subido_por: userAgroId,
        subido_en: new Date('2025-02-20'),
      },
      {
        _id: fixedId('doc-centro:plano-terminal-valparaiso'),
        centro_costo_id: centroTerminalId,
        nombre: 'plano_terminal_valparaiso.pdf',
        nombre_display: 'Plano Terminal Valparaíso.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 398000,
        s3_key: s3Key('centro', centroTerminalId, 'plano_terminal_valparaiso.pdf'),
        categoria: 'planos',
        subido_por: userTransporteId,
        subido_en: new Date('2025-03-05'),
      },
      {
        _id: fixedId('doc-centro:permiso-edificacion-torre-b'),
        centro_costo_id: centroObraId,
        nombre: 'permiso_edificacion_torre_b.pdf',
        nombre_display: 'Permiso Edificación Torre B.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 289000,
        s3_key: s3Key('centro', centroObraId, 'permiso_edificacion_torre_b.pdf'),
        categoria: 'permisos',
        subido_por: userConstructoraId,
        subido_en: new Date('2025-03-25'),
      },
    ];
    await seedCollection(db.collection('doc_centro_costo'), docCentroCostoData);

    // ---------------------------------------------------------------
    // 16) Documentos de proyectos (5) — doc_proyecto
    // ---------------------------------------------------------------
    const docProyectoData = [
      {
        _id: fixedId('doc-proyecto:eia-ampliacion-el-cobre'),
        proyecto_id: proyAmplId,
        nombre: 'especificacion_iot_el_cobre.pdf',
        nombre_display: 'Especificación IoT El Cobre.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 620000,
        s3_key: s3Key('proyecto', proyAmplId, 'especificacion_iot_el_cobre.pdf'),
        categoria: 'tecnico',
        subido_por: adminMineraId,
        subido_en: new Date('2026-01-20'),
      },
      {
        _id: fixedId('doc-proyecto:plan-mantenimiento-los-andes'),
        proyecto_id: proyMantId,
        nombre: 'plan_mantencion_los_andes.pdf',
        nombre_display: 'Plan Mantención Integral Los Andes.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 154000,
        s3_key: s3Key('proyecto', proyMantId, 'plan_mantencion_los_andes.pdf'),
        categoria: 'planificacion',
        subido_por: adminMineraId,
        subido_en: new Date('2026-06-01'),
      },
      {
        _id: fixedId('doc-proyecto:informe-auditoria-certificacion'),
        proyecto_id: proyCertId,
        nombre: 'informe_auditoria_energetica.pdf',
        nombre_display: 'Informe Auditoría Energética.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 187000,
        s3_key: s3Key('proyecto', proyCertId, 'informe_auditoria_energetica.pdf'),
        categoria: 'informes',
        subido_por: userAgroId,
        subido_en: new Date('2025-12-10'),
      },
      {
        _id: fixedId('doc-proyecto:cotizacion-gruas-terminal'),
        proyecto_id: proyModId,
        nombre: 'cotizacion_tableros_terminal.pdf',
        nombre_display: 'Cotización Tableros Eléctricos Terminal.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 96000,
        s3_key: s3Key('proyecto', proyModId, 'cotizacion_tableros_terminal.pdf'),
        categoria: 'financiero',
        subido_por: userTransporteId,
        subido_en: new Date('2026-02-14'),
      },
      {
        _id: fixedId('doc-proyecto:contrato-construccion-torre-b'),
        proyecto_id: proyConstId,
        nombre: 'contrato_construccion_torre_b.pdf',
        nombre_display: 'Contrato Construcción Torre B.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 341000,
        s3_key: s3Key('proyecto', proyConstId, 'contrato_construccion_torre_b.pdf'),
        categoria: 'legal',
        subido_por: userConstructoraId,
        subido_en: new Date('2025-06-05'),
      },
    ];
    await seedCollection(db.collection('doc_proyecto'), docProyectoData);

    // ---------------------------------------------------------------
    // 17) Documentos de actividades (5) — doc_actividad
    // ---------------------------------------------------------------
    const docActividadData = [
      {
        _id: fixedId('doc-actividad:checklist-inspeccion-camiones'),
        actividad_id: actInspeccionId,
        nombre: 'checklist_inspeccion_camiones.pdf',
        nombre_display: 'Checklist Inspección Camiones.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 54000,
        s3_key: s3Key('actividad', actInspeccionId, 'checklist_inspeccion_camiones.pdf'),
        subido_en: new Date('2026-06-10'),
      },
      {
        _id: fixedId('doc-actividad:orden-trabajo-excavadora'),
        actividad_id: actCorrectivaId,
        nombre: 'orden_trabajo_excavadora.pdf',
        nombre_display: 'Orden Trabajo Excavadora.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 61000,
        s3_key: s3Key('actividad', actCorrectivaId, 'orden_trabajo_excavadora.pdf'),
        subido_en: new Date('2026-06-18'),
      },
      {
        _id: fixedId('doc-actividad:lista-asistencia-capacitacion'),
        actividad_id: actCapacitacionId,
        nombre: 'lista_asistencia_capacitacion.pdf',
        nombre_display: 'Lista Asistencia Capacitación.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 43000,
        s3_key: s3Key('actividad', actCapacitacionId, 'lista_asistencia_capacitacion.pdf'),
        subido_en: new Date('2026-06-22'),
      },
      {
        _id: fixedId('doc-actividad:bitacora-mantenimiento-grua'),
        actividad_id: actPreventivaId,
        nombre: 'bitacora_mantenimiento_grua.pdf',
        nombre_display: 'Bitácora Mantenimiento Grúa.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 58000,
        s3_key: s3Key('actividad', actPreventivaId, 'bitacora_mantenimiento_grua.pdf'),
        subido_en: new Date('2026-07-01'),
      },
      {
        _id: fixedId('doc-actividad:informe-auditoria-seguridad'),
        actividad_id: actAuditoriaId,
        nombre: 'informe_auditoria_seguridad.pdf',
        nombre_display: 'Informe Auditoría Seguridad.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 112000,
        s3_key: s3Key('actividad', actAuditoriaId, 'informe_auditoria_seguridad.pdf'),
        subido_en: new Date('2026-07-03'),
      },
    ];
    await seedCollection(db.collection('doc_actividad'), docActividadData);

    // ---------------------------------------------------------------
    // 18) Documentos de activos (5) — doc_activo
    // ---------------------------------------------------------------
    const docActivoData = [
      {
        _id: fixedId('doc-activo:ficha-camion-tolva'),
        activo_id: activoCamionId,
        nombre: 'ficha_tecnica_camion_tolva.pdf',
        nombre_display: 'Ficha Técnica Camión Tolva.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 87000,
        s3_key: s3Key('activo', activoCamionId, 'ficha_tecnica_camion_tolva.pdf'),
        subido_en: new Date('2025-01-08'),
      },
      {
        _id: fixedId('doc-activo:manual-excavadora'),
        activo_id: activoExcavId,
        nombre: 'manual_excavadora_cat_320.pdf',
        nombre_display: 'Manual Excavadora CAT 320.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 341000,
        s3_key: s3Key('activo', activoExcavId, 'manual_excavadora_cat_320.pdf'),
        subido_en: new Date('2025-01-15'),
      },
      {
        _id: fixedId('doc-activo:ficha-generador'),
        activo_id: activoGenId,
        nombre: 'ficha_tecnica_generador.pdf',
        nombre_display: 'Ficha Técnica Generador.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 76000,
        s3_key: s3Key('activo', activoGenId, 'ficha_tecnica_generador.pdf'),
        subido_en: new Date('2025-02-01'),
      },
      {
        _id: fixedId('doc-activo:certificado-grua-horquilla'),
        activo_id: activoGruaId,
        nombre: 'certificado_grua_horquilla.pdf',
        nombre_display: 'Certificado Grúa Horquilla.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 65000,
        s3_key: s3Key('activo', activoGruaId, 'certificado_grua_horquilla.pdf'),
        subido_en: new Date('2025-02-18'),
      },
      {
        _id: fixedId('doc-activo:certificado-andamio-modular'),
        activo_id: activoAndamioId,
        nombre: 'certificado_andamio_modular.pdf',
        nombre_display: 'Certificado Andamio Modular.pdf',
        tipo_mime: 'application/pdf',
        tamano_bytes: 49000,
        s3_key: s3Key('activo', activoAndamioId, 'certificado_andamio_modular.pdf'),
        subido_en: new Date('2025-03-02'),
      },
    ];
    await seedCollection(db.collection('doc_activo'), docActivoData);

    console.log('Seed de datos simulados completado.\n');
    console.log(JSON.stringify({
      clientes: clientesData.length,
      usuarios: usuariosData.length,
      centros_costos: centrosData.length,
      tipos_proyecto: tiposProyectoData.length,
      proyectos: proyectosData.length,
      recordatorios: recordatoriosData.length,
      tipos_activo: tiposActivoData.length,
      activos: activosData.length,
      tipos_actividad: tiposActividadData.length,
      actividades: actividadesData.length,
      solicitudes: solicitudesData.length,
      permisos: permisosData.length,
      noticias: noticiasData.length,
      documentos_vencidos: docsVencidosData.length,
      doc_cliente: docClienteData.length,
      doc_centro_costo: docCentroCostoData.length,
      doc_proyecto: docProyectoData.length,
      doc_actividad: docActividadData.length,
      doc_activo: docActivoData.length,
    }, null, 2));

    console.log('\nCredenciales de acceso (todas usan la misma contraseña de prueba):');
    console.log(`  password: ${DEMO_PASSWORD}`);
    usuariosData.forEach((u) => console.log(`  - ${u.email} (${u.rol})`));

    process.exit(0);
  } catch (err) {
    console.error('Error durante el seed:', err);
    process.exit(1);
  }
}

main();
