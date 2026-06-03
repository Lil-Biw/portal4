// Ejecutado antes de `ng build` — genera environment.prod.ts con la URL del backend.
// En Vercel: Settings → Environment Variables → API_URL = https://tu-backend.vercel.app/api/v1
const { writeFileSync } = require('fs');
const { join } = require('path');

const apiUrl = process.env['API_URL'];
if (!apiUrl) {
  if (process.env['NODE_ENV'] === 'production') {
    console.error('[set-env] ERROR: API_URL no está definida. Define la variable en Vercel → Settings → Environment Variables antes de hacer build.');
    process.exit(1);
  }
  console.warn('[set-env] AVISO: API_URL no definida, usando http://localhost:3000/api/v1 (solo desarrollo)');
}
const resolvedUrl = apiUrl || 'http://localhost:3000/api/v1';

const content = `// Generado automáticamente por scripts/set-env.js — no editar a mano.
export const environment = {
  production: true,
  apiUrl: '${resolvedUrl}',
};
`;

writeFileSync(join(__dirname, '../src/environments/environment.prod.ts'), content);
console.log(`[set-env] API_URL → ${resolvedUrl}`);
