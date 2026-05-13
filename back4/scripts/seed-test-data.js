/* Seed script for portal-api test data
   Inserts: 1 cliente, 2 usuarios (admin and usuario), 1 centro de costos, 1 proyecto
   Usage: node scripts/seed-test-data.js
*/

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

async function main() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection;

  try {
    // Clean up any previous test data markers (optional)

    // 1) Create Cliente
    const cliente = {
      razon_social: 'Cliente Prueba S.A.',
      rut: '12345678-9',
      email_contacto: 'contacto@clienteprueba.local',
      telefono: '+56912345678',
      direccion: { calle: 'Av. Principal 123', ciudad: 'Santiago', region: 'RM', pais: 'Chile' },
      activo: true,
    };
    const clientesColl = db.collection('clientes');
    const resCliente = await clientesColl.insertOne(cliente);
    const clienteId = resCliente.insertedId;

    // 2) Create two Usuarios
    const plainPassAdmin = 'AdminPass123!';
    const plainPassUser = 'UserPass123!';
    const hashAdmin = await bcrypt.hash(plainPassAdmin, 10);
    const hashUser = await bcrypt.hash(plainPassUser, 10);

    const usuariosColl = db.collection('usuarios');

    const adminUser = {
      cliente_id: clienteId,
      nombre: 'Admin Prueba',
      email: 'admin@clienteprueba.local',
      password_hash: hashAdmin,
      rol: 'admin_cliente',
      activo: true,
    };

    const normalUser = {
      cliente_id: clienteId,
      nombre: 'Usuario Prueba',
      email: 'user@clienteprueba.local',
      password_hash: hashUser,
      rol: 'usuario',
      activo: true,
    };

    const resAdmin = await usuariosColl.insertOne(adminUser);
    const resUser = await usuariosColl.insertOne(normalUser);
    const adminId = resAdmin.insertedId;
    const userId = resUser.insertedId;

    // 3) Create Centro de Costos
    const centrosColl = db.collection('centros_costos');
    const centro = {
      cliente_id: clienteId,
      codigo: 'CC-001',
      nombre: 'Centro Prueba',
      descripcion: 'Centro para pruebas E2E',
      activo: true,
      documentos: [],
    };
    const resCentro = await centrosColl.insertOne(centro);
    const centroId = resCentro.insertedId;

    // 4) Create Proyecto
    const proyectosColl = db.collection('proyectos');
    const proyecto = {
      centro_costo_id: centroId,
      cliente_id: clienteId,
      codigo: 'PRJ-001',
      nombre: 'Proyecto Prueba',
      descripcion: 'Proyecto para pruebas E2E',
      estado: 'borrador',
      documentos: [],
      creado_por: adminId,
    };
    const resProyecto = await proyectosColl.insertOne(proyecto);
    const proyectoId = resProyecto.insertedId;

    console.log('Seed completed. Inserted IDs and credentials:\n');
    console.log(JSON.stringify({
      cliente: { id: clienteId.toString(), razon_social: cliente.razon_social },
      admin: { id: adminId.toString(), email: adminUser.email, password: plainPassAdmin },
      usuario: { id: userId.toString(), email: normalUser.email, password: plainPassUser },
      centro_costo: { id: centroId.toString(), codigo: centro.codigo, nombre: centro.nombre },
      proyecto: { id: proyectoId.toString(), codigo: proyecto.codigo, nombre: proyecto.nombre },
    }, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error during seed:', err);
    process.exit(1);
  } finally {
    // leave connection to allow process to exit on success path
  }
}

main();
