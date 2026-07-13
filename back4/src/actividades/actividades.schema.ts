import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export type ActividadDocument = Actividad & Document;

@Schema({ collection: 'actividades', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Actividad {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoActividad', required: true }) tipo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  // OJO: dentro de un array, el tipo debe ser SchemaTypes.ObjectId; con Types.ObjectId
  // el SchemaFactory de Nest lo degrada a Mixed sin ref y populate() no hace nada.
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'Activo' }], default: [] }) activo_ids: Types.ObjectId[];
  @Prop({ required: true }) fecha: Date;
  @Prop() fecha_termino?: Date;
  // Días de antelación a la fecha (o fecha_termino) en que se avisa a los admins
  // suscritos (subconjunto de [30, 15, 7, 3, 1, 0]; 0 = el día de la actividad).
  // Vacío = la actividad no genera recordatorios.
  @Prop({ type: [Number], default: [] }) dias_recordatorio: number[];
  // Último umbral de dias_recordatorio ya notificado (idempotencia del cron):
  // evita reenviar el mismo aviso si el cron corre dos veces el mismo día y
  // permite catch-up si estuvo caído. Ausente = nunca se ha avisado.
  @Prop() ultimo_recordatorio_dias?: number;
}

export const ActividadSchema = SchemaFactory.createForClass(Actividad);
ActividadSchema.index({ centro_costo_id: 1, fecha: 1 });
