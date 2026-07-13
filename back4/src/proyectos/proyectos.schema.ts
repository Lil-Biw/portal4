import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export type ProyectoDocument = Proyecto & Document;

@Schema({ collection: 'proyectos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Proyecto {
  // OJO: dentro de un array, el tipo debe ser SchemaTypes.ObjectId; con Types.ObjectId
  // el SchemaFactory de Nest lo degrada a Mixed sin ref y populate() no hace nada.
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'CentroCosto' }], required: true }) centro_costo_ids: Types.ObjectId[];
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'TipoProyecto' }) tipo_proyecto_id?: Types.ObjectId;
  @Prop({ required: true, trim: true }) codigo: string;
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({
    enum: ['borrador', 'planificacion', 'activo', 'en_pausa', 'en_revision', 'cerrado', 'cancelado'],
    default: 'borrador',
  }) estado: string;
  @Prop() fecha_inicio?: Date;
  @Prop() fecha_fin?: Date;
  // Días de antelación a fecha_fin en que se avisa a los admins suscritos
  // (subconjunto de [30, 15, 7, 3, 1, 0]; 0 = el día de término).
  // Vacío = el proyecto no genera recordatorios de vencimiento.
  @Prop({ type: [Number], default: [] }) dias_recordatorio: number[];
  // Último umbral de dias_recordatorio ya notificado (idempotencia del cron):
  // evita reenviar el mismo aviso si el cron corre dos veces el mismo día y
  // permite catch-up si estuvo caído. Ausente = nunca se ha avisado.
  @Prop() ultimo_recordatorio_dias?: number;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) creado_por?: Types.ObjectId;
}

export const ProyectoSchema = SchemaFactory.createForClass(Proyecto);
ProyectoSchema.index({ centro_costo_ids: 1, estado: 1 });
ProyectoSchema.index({ cliente_id: 1, estado: 1 });
ProyectoSchema.index({ centro_costo_ids: 1, codigo: 1 }, { unique: true });
ProyectoSchema.index({ tipo_proyecto_id: 1 });
