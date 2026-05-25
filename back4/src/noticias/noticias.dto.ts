import { IsString, MinLength } from 'class-validator';

export class CreateNoticiaDto {
  @IsString() @MinLength(2) titulo: string;
  @IsString() @MinLength(5) enlace: string;
  @IsString() @MinLength(5) resumen: string;
}
