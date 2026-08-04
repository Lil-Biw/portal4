import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

const ID_PARAM_PATTERN = /^id$|Id$/;

@Injectable()
export class ParseObjectIdPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'param' || !metadata.data || !ID_PARAM_PATTERN.test(metadata.data)) {
      return value;
    }
    if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${metadata.data} inválido: "${value}" no es un ObjectId válido`);
    }
    return value;
  }
}
