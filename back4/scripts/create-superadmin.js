/* Crea el usuario super_admin para el portal interno.
   Uso: node scripts/create-superadmin.js
   Variables de entorno opcionales:
     ADMIN_EMAIL    (default: admin@eclariti.cl)
     ADMIN_PASSWORD (default: Admin123!)
     MONGODB_URI    (default: mongodb://localhost:27017/portal_clientes)
*/

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const MONGO    = process.env.MONGODB_URI    || 'mongodb://localhost:27017/portal_clientes';
const EMAIL    = process.env.ADMIN_EMAIL    || 'admin@smartclarity.cl';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

async function main() {
  await mongoose.connect(MONGO);
  const usuarios = mongoose.connection.collection('usuarios');

  const existe = await usuarios.findOne({ email: EMAIL });
  if (existe) {
    console.log(`Ya existe un usuario con el email: ${EMAIL}`);
    await mongoose.connection.close();
    return;
  }

  const password_hash = await bcrypt.hash(PASSWORD, 10);

  const resultado = await usuarios.insertOne({
    nombre:        'Super Admin',
    email:         EMAIL,
    password_hash,
    rol:           'super_admin',
    activo:        true,
    creado_en:     new Date(),
    actualizado_en: new Date(),
  });

  console.log('Usuario super_admin creado:');
  console.log(JSON.stringify({ id: resultado.insertedId.toString(), email: EMAIL, password: PASSWORD }, null, 2));

  await mongoose.connection.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
