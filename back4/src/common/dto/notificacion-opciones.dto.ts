import { IsBoolean, IsEnum, IsArray, IsMongoId, IsOptional, ValidateIf } from 'class-validator';

export class NotificacionOpcionesDto {
  @IsBoolean()
  notificar: boolean;

  @IsEnum(['todos', 'especificos'])
  @ValidateIf(o => o.notificar === true)
  @IsOptional()
  audiencia?: 'todos' | 'especificos';

  @IsArray()
  @IsMongoId({ each: true })
  @ValidateIf(o => o.notificar === true && o.audiencia === 'especificos')
  @IsOptional()
  destinatarios_ids?: string[];

  @IsBoolean()
  @IsOptional()
  notificar_super_admins?: boolean;
}
