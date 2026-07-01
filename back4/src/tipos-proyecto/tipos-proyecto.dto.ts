import { IsString, IsOptional, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateTipoProyectoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() color?: string;
}

export class UpdateTipoProyectoDto extends PartialType(CreateTipoProyectoDto) {}
