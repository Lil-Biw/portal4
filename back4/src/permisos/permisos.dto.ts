import { IsMongoId, IsEnum } from 'class-validator';

export class AsignarPermisoDto {
  @IsMongoId() usuario_id: string;
  @IsMongoId() centro_costo_id: string;
  @IsEnum(['ver', 'editar']) tipo: 'ver' | 'editar';
}

export class ActualizarPermisoDto {
  @IsEnum(['ver', 'editar']) tipo: 'ver' | 'editar';
}
