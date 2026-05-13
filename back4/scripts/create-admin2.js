const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://localhost:27017/portal_clientes').then(async () => {
  const usuarioSchema = new mongoose.Schema({}, { strict: false });
  const Usuario = mongoose.model('Usuario', usuarioSchema, 'usuarios');
  
  // Crear un nuevo admin
  const admin = {
    nombre: 'Admin Sistema',
    email: 'admin@sistema.local',
    password_hash: await bcrypt.hash('admin123', 10),
    rol: 'admin_sistema',
    activo: true,
    creado_en: new Date(),
    ultimo_acceso: null
  };
  
  try {
    await Usuario.create(admin);
    console.log('✓ Admin creado exitosamente');
    console.log('Email:', admin.email);
    console.log('Contraseña: admin123');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  process.exit(0);
});
