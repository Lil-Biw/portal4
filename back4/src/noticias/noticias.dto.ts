import { IsString, MinLength, IsEnum } from 'class-validator';

export class CreateNoticiaDto {
  @IsString() @MinLength(2)  titulo: string;
  @IsString() @MinLength(5)  enlace: string;
  @IsString() @MinLength(5)  resumen: string;
  @IsEnum(['novedades', 'normativas', 'anuncios']) seccion: 'novedades' | 'normativas' | 'anuncios';
}
