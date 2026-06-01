/**
 * Ejecutar desde back4/:
 *   node scripts/test-mail.js
 *
 * Prueba la conexión SMTP de Gmail y envía un correo de diagnóstico.
 * Lee MAIL_USER y MAIL_PASS del archivo .env en el mismo directorio.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

const user = process.env.MAIL_USER;
const pass = process.env.MAIL_PASS;
const dest = process.env.MAIL_USER; // enviar a sí mismo para testear

console.log('─── Configuración leída desde .env ─────────────────────────');
console.log(`MAIL_USER : "${user}"`);
console.log(`MAIL_PASS : "${pass ? '(definida, ' + pass.length + ' chars)' : '(VACÍA)'}"`);
console.log(`Destino   : ${dest}`);
console.log('');

if (!user || !pass) {
  console.error('ERROR: MAIL_USER o MAIL_PASS no están definidos en .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user, pass },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
});

(async () => {
  // 1. Verificar conexión
  console.log('1. Verificando conexión con smtp.gmail.com:465 ...');
  try {
    await transporter.verify();
    console.log('   ✓ Conexión OK\n');
  } catch (err) {
    console.error('   ✗ Fallo de conexión:', err.message);
    console.error('   Código:', err.code);
    console.error('   Respuesta SMTP:', err.response ?? '(sin respuesta)');
    console.error('\nCausas comunes:');
    console.error('  - 2FA de Google no está activada → hay que activarla para usar App Passwords');
    console.error('  - La "Contraseña de aplicación" fue creada pero ya fue revocada');
    console.error('  - El servidor no fue reiniciado después de editar .env');
    process.exit(1);
  }

  // 2. Enviar correo de prueba
  console.log(`2. Enviando correo de prueba a ${dest} ...`);
  try {
    const info = await transporter.sendMail({
      from: `"Test ECLARITI" <${user}>`,
      to: dest,
      subject: 'Test SMTP — Portal ECLARITI',
      text: 'Si recibes este correo, el envío de emails está funcionando correctamente.',
      html: '<p>Si recibes este correo, el envío de emails está funcionando correctamente.</p>',
    });
    console.log('   ✓ Correo enviado!');
    console.log('   messageId:', info.messageId);
    console.log('   response :', info.response);
  } catch (err) {
    console.error('   ✗ Error al enviar:', err.message);
    console.error('   Código:', err.code);
    console.error('   Respuesta SMTP:', err.response ?? '(sin respuesta)');
  }
})();
