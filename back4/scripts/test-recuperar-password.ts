// Prueba end-to-end del flujo de recuperación de contraseña.
// npm run test:recuperar-password   (usa ts-node, igual que test-recordatorios.ts)
//
// - Corre contra una base de datos TEMPORAL (portal4_test_recuperar_password)
//   derivada del MONGODB_URI del .env; se borra al final. No toca datos reales.
// - Intercepta MailService: no se envía ningún correo real, solo se captura el
//   resetUrl (y por lo tanto el token) que se habría enviado.
// - Levanta la app completa (HTTP real, ValidationPipe global) en un puerto
//   efímero para probar /auth/forgot-password y /auth/reset-password tal como
//   los golpea el frontend.
import 'dotenv/config';
import * as jwt from 'jsonwebtoken';

const TEST_DB = 'portal4_test_recuperar_password';

function uriConDb(uri: string, db: string): string {
  try {
    const u = new URL(uri);
    u.pathname = `/${db}`;
    return u.toString();
  } catch {
    const [main, query] = uri.split('?');
    const sinDb = main.replace(/\/[^/]*$/, '');
    return `${sinDb}/${db}${query ? `?${query}` : ''}`;
  }
}

async function main() {
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';
  process.env.MONGODB_URI = uriConDb(baseUri, TEST_DB);
  console.log(`Base de datos de prueba: ${TEST_DB}`);

  const jwtSecret = process.env.JWT_SECRET || 'cambia_este_secreto_en_produccion';

  const { NestFactory } = await import('@nestjs/core');
  const { ValidationPipe } = await import('@nestjs/common');
  const { Types } = await import('mongoose');
  const { getConnectionToken } = await import('@nestjs/mongoose');
  const bcrypt = await import('bcryptjs');
  const { AppModule } = await import('../src/app.module');
  const { MailService } = await import('../src/mail/mail.service');

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const correosCapturados: { email: string; resetUrl: string }[] = [];
  const mail: any = app.get(MailService);
  mail.notificarRecuperarPassword = async (args: any) => {
    correosCapturados.push({ email: args.email, resetUrl: args.resetUrl });
  };

  await app.listen(0);
  const address: any = app.getHttpServer().address();
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const conn: any = app.get(getConnectionToken());
  const db = conn.db;

  // ── Siembra ─────────────────────────────────────────────────────────────
  const EMAIL = 'qa.recuperar@test.local';
  const PASSWORD_ORIGINAL = 'ClaveOriginal123!';
  const usuarioId = new Types.ObjectId();
  await db.collection('usuarios').insertOne({
    _id: usuarioId,
    nombre: 'QA Recuperar Password',
    email: EMAIL,
    password_hash: await bcrypt.hash(PASSWORD_ORIGINAL, 10),
    rol: 'usuario',
    activo: true,
    debe_cambiar_password: false,
  });

  // ── Helpers ─────────────────────────────────────────────────────────────
  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  function extraerToken(resetUrl: string): string {
    return new URL(resetUrl).searchParams.get('token') || '';
  }

  async function forgotPassword(email: string) {
    const res = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return { status: res.status, body: await res.json() };
  }

  async function resetPassword(token: string, password_nueva: string) {
    const res = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password_nueva }),
    });
    return { status: res.status, body: await res.json() };
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return { status: res.status, body: await res.json() };
  }

  function huellaPassword(passwordHash: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
  }

  // ── Casos ───────────────────────────────────────────────────────────────
  console.log('\n1) forgot-password con email existente');
  const r1 = await forgotPassword(EMAIL);
  check(r1.status === 200, `responde 200 (obtuvo ${r1.status})`);
  check(correosCapturados.length === 1, `se capturó 1 correo (${correosCapturados.length})`);

  console.log('\n2) forgot-password con email inexistente (no debe filtrar info)');
  const correosAntes = correosCapturados.length;
  const r2 = await forgotPassword('no-existe-xyz@test.local');
  check(r2.status === r1.status, `mismo status que email existente (${r2.status} vs ${r1.status})`);
  check(JSON.stringify(r2.body) === JSON.stringify(r1.body), 'mismo mensaje de respuesta que email existente');
  check(correosCapturados.length === correosAntes, 'NO se disparó ningún correo para email inexistente');

  console.log('\n3) forgot-password con email con formato inválido');
  const r3 = await forgotPassword('esto-no-es-un-email');
  check(r3.status === 400, `responde 400 por validación (obtuvo ${r3.status})`);

  console.log('\n4) reset-password con token válido');
  const tokenValido = extraerToken(correosCapturados[0].resetUrl);
  check(!!tokenValido, 'se pudo extraer el token del resetUrl');
  const r4 = await resetPassword(tokenValido, 'NuevaClave123!');
  check(r4.status === 200, `responde 200 (obtuvo ${r4.status}, body: ${JSON.stringify(r4.body)})`);

  console.log('\n5) login con la nueva contraseña funciona, con la vieja ya no');
  const r5ok = await login(EMAIL, 'NuevaClave123!');
  check(r5ok.status === 200, `login con clave nueva → 200 (obtuvo ${r5ok.status})`);
  const r5fail = await login(EMAIL, PASSWORD_ORIGINAL);
  check(r5fail.status === 401, `login con clave vieja → 401 (obtuvo ${r5fail.status})`);

  console.log('\n6) reset-password reutilizando el mismo token ya usado');
  const r6 = await resetPassword(tokenValido, 'OtraClave456!');
  check(r6.status === 401, `responde 401 por token ya usado (obtuvo ${r6.status})`);

  console.log('\n7) reset-password con token de propósito incorrecto');
  const usuarioActual: any = await db.collection('usuarios').findOne({ _id: usuarioId });
  const tokenPurposeIncorrecto = jwt.sign(
    { sub: usuarioId.toString(), purpose: 'otro_proposito', pwv: huellaPassword(usuarioActual.password_hash) },
    jwtSecret,
    { expiresIn: '30m' },
  );
  const r7 = await resetPassword(tokenPurposeIncorrecto, 'NuevaClave789!');
  check(r7.status === 401, `responde 401 por propósito incorrecto (obtuvo ${r7.status})`);

  console.log('\n8) reset-password con token expirado');
  const tokenExpirado = jwt.sign(
    { sub: usuarioId.toString(), purpose: 'reset_password', pwv: huellaPassword(usuarioActual.password_hash) },
    jwtSecret,
    { expiresIn: '-10s' },
  );
  const r8 = await resetPassword(tokenExpirado, 'NuevaClave789!');
  check(r8.status === 401, `responde 401 por token expirado (obtuvo ${r8.status})`);

  console.log('\n9) reset-password con token basura');
  const r9 = await resetPassword('esto.no.es-un-jwt', 'NuevaClave789!');
  check(r9.status === 401, `responde 401 por token inválido (obtuvo ${r9.status})`);

  console.log('\n10) reset-password con contraseña nueva demasiado corta');
  const r10prev = await forgotPassword(EMAIL);
  check(r10prev.status === 200, 'se generó un nuevo token para este caso');
  const tokenFresco = extraerToken(correosCapturados[correosCapturados.length - 1].resetUrl);
  const r10 = await resetPassword(tokenFresco, 'corta1');
  check(r10.status === 400, `responde 400 por password < 8 caracteres (obtuvo ${r10.status})`);

  // ── Limpieza ────────────────────────────────────────────────────────────
  await db.dropDatabase();
  await app.close();
  console.log(`\nBase ${TEST_DB} eliminada.`);

  if (fallas > 0) {
    console.error(`\n${fallas} verificación(es) fallaron.`);
    process.exit(1);
  }
  console.log('Todas las verificaciones pasaron ✅');
}

main().catch(err => { console.error(err); process.exit(1); });
