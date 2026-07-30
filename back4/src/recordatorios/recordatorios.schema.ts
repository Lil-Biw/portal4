import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RecordatorioDocument = Recordatorio & Document;

// Un doc por proyecto/actividad con avisos configurados (dias no vacío) o con
// fecha_fin conocida (proyectos: para el auto-cierre, que no depende de dias).
// Reemplaza los campos dias_recordatorio/ultimo_recordatorio_dias que antes
// vivían embebidos en Proyecto/Actividad.
@Schema({ collection: 'recordatorios', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Recordatorio {
  @Prop({ required: true, enum: ['proyecto', 'actividad'] }) tipo: 'proyecto' | 'actividad';
  @Prop({ type: Types.ObjectId, required: true }) entidad_id: Types.ObjectId;
  // Subconjunto de [365, 180, 30, 15, 7, 3, 1, 0] (0 = el día de término/actividad).
  @Prop({ type: [Number], default: [] }) dias: number[];
  @Prop({ required: true }) fecha_fin: Date;
  // Último umbral de "dias" ya notificado (idempotencia del cron).
  @Prop() ultimo_recordatorio_dias?: number;
}

export const RecordatorioSchema = SchemaFactory.createForClass(Recordatorio);
RecordatorioSchema.index({ tipo: 1, entidad_id: 1 }, { unique: true });
RecordatorioSchema.index({ fecha_fin: 1 });
