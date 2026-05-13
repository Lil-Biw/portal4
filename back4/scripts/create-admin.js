/* Create a fresh admin user for dashboard testing.
   Usage: node scripts/create-admin.js
*/

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

async function main() {
  await mongoose.connect(MONGO);
  const db = mongoose.connection;

  const clientesColl = db.collection('clientes');
  const usuariosColl = db.collection('usuarios');

  const suffix = Date.now().toString().slice(-6);
  const cliente = {
    razon_social: `Cliente Dashboard ${suffix}`,
    rut: `99${suffix}-9`,
    email_contacto: `contacto+${suffix}@dashboard.local`,
    telefono: '+56900000000',
    direccion: { calle: 'Ruta 1', ciudad: 'Santiago', region: 'RM', pais: 'Chile' },
    activo: true,
  };

  const clienteRes = await clientesColl.insertOne(cliente);
  const clienteId = clienteRes.insertedId;

  const password = 'DashAdmin123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = {
    cliente_id: clienteId,
    nombre: 'Admin Dashboard',
    email: `admin+${suffix}@dashboard.local`,
    password_hash: passwordHash,
    rol: 'admin_cliente',
    activo: true,
  };

  const adminRes = await usuariosColl.insertOne(admin);

  console.log('Nuevo admin creado.');
  console.log(JSON.stringify({
    cliente_id: clienteId.toString(),
    admin_id: adminRes.insertedId.toString(),
    email: admin.email,
    password,
  }, null, 2));

  await db.close();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
