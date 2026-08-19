// Prueba unitaria de ParseObjectIdPipe (tofix.md #16).
// npm run test:parse-object-id-pipe   (usa ts-node, igual que otros scripts test:*)
//
// Reproduce el bug reportado: GET /usuarios/1000 (o cualquier :id/:xId malformado
// en cualquier módulo) lanzaba un CastError de Mongoose sin capturar → 500.
// El pipe debe convertir eso en un BadRequestException (400) ANTES de llegar
// al service, y no debe tocar params que no representan un ObjectId.
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { Types } from 'mongoose';

async function main() {
  const { ParseObjectIdPipe } = await import('../src/common/pipes/parse-object-id.pipe');
  const pipe = new ParseObjectIdPipe();

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  const paramMeta = (data: string): ArgumentMetadata => ({ type: 'param', data, metatype: String });
  const otherMeta = (type: ArgumentMetadata['type'], data?: string): ArgumentMetadata => ({ type, data, metatype: undefined });

  // 1) El caso reportado: "1000" como :id
  try {
    pipe.transform('1000', paramMeta('id'));
    check(false, '"1000" en :id lanza BadRequestException');
  } catch (e) {
    check(e instanceof BadRequestException, '"1000" en :id lanza BadRequestException');
  }

  // 2) Mismo caso pero en un param anidado tipo :empresaId
  try {
    pipe.transform('abc', paramMeta('empresaId'));
    check(false, '"abc" en :empresaId lanza BadRequestException');
  } catch (e) {
    check(e instanceof BadRequestException, '"abc" en :empresaId lanza BadRequestException');
  }

  // 3) Un ObjectId válido pasa sin problemas
  const validId = new Types.ObjectId().toString();
  const resultado = pipe.transform(validId, paramMeta('id'));
  check(resultado === validId, `ObjectId válido pasa intacto (${validId})`);

  // 4) Params que no son :id/:xId no se tocan (ej. :estado)
  const resultadoEstado = pipe.transform('rechazado', paramMeta('estado'));
  check(resultadoEstado === 'rechazado', 'param sin forma de ObjectId (ej. :estado) no se valida');

  // 5) Body y query no se tocan aunque el valor sea inválido como ObjectId
  const resultadoBody = pipe.transform({ nombre: 'x' }, otherMeta('body'));
  check(resultadoBody && (resultadoBody as any).nombre === 'x', 'argumentos de @Body no se tocan');

  const resultadoQuery = pipe.transform('1000', otherMeta('query', 'limit'));
  check(resultadoQuery === '1000', 'argumentos de @Query no se tocan');

  if (fallas > 0) {
    console.error(`\n${fallas} verificación(es) fallaron.`);
    process.exit(1);
  }
  console.log('\nTodas las verificaciones pasaron ✅');
}

main().catch(err => { console.error(err); process.exit(1); });
