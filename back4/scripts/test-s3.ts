/**
 * Verifica que las credenciales y el bucket de S3 funcionan: sube un archivo de
 * prueba, lo descarga, compara el contenido, y lo borra.
 *
 * Ejecutar desde back4/:
 *   npx tsx scripts/test-s3.ts
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET_NAME ?? '';
const region = process.env.AWS_REGION ?? '';

if (!bucket || !region) {
  console.error('ERROR: S3_BUCKET_NAME o AWS_REGION no están definidos en .env');
  process.exit(1);
}

async function main() {
  const client = new S3Client({ region });
  const key = `documentos/_test/${Date.now()}_test.txt`;
  const contenido = Buffer.from('hola desde test-s3.ts');

  console.log(`Subiendo ${key} a bucket ${bucket}...`);
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: contenido, ContentType: 'text/plain' }));

  console.log('Descargando...');
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const stream = res.Body as AsyncIterable<Uint8Array>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const descargado = Buffer.concat(chunks);

  if (!descargado.equals(contenido)) {
    console.error('FALLÓ: el contenido descargado no coincide con el subido');
    process.exit(1);
  }
  console.log('OK: contenido coincide.');

  console.log('Borrando objeto de prueba...');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

  console.log('S3 OK: subida, descarga y borrado funcionan correctamente.');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
