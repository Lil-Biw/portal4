import { IsString, IsOptional, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateTipoMantencionDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() color?: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class UpdateTipoMantencionDto extends PartialType(CreateTipoMantencionDto) {}
