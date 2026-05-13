// Ejecutado antes de `ng build` — genera environment.prod.ts con la URL del backend.
// En Vercel: Settings → Environment Variables → API_URL = https://tu-backend.vercel.app/api/v1
const { writeFileSync } = require('fs');
const { join } = require('path');

const apiUrl = process.env['API_URL'] || 'http://localhost:3000/api/v1';

const content = `// Generado automáticamente por scripts/set-env.js — no editar a mano.
export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
};
`;

writeFileSync(join(__dirname, '../src/environments/environment.prod.ts'), content);
console.log(`[set-env] API_URL → ${apiUrl}`);
