import { IsString, MinLength, IsObject } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateRolDto {
  @IsString() @MinLength(2) nombre: string;
  @IsObject() permisos: Record<string, Record<string, boolean>>;
}

export class UpdateRolDto extends PartialType(CreateRolDto) {}
