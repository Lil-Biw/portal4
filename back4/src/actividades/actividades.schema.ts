import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActividadDocument = Actividad & Document;

@Schema({ collection: 'actividades', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Actividad {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoActividad', required: true }) tipo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Activo' }], default: [] }) activo_ids: Types.ObjectId[];
  @Prop({ required: true }) fecha: Date;
}

export const ActividadSchema = SchemaFactory.createForClass(Actividad);
ActividadSchema.index({ centro_costo_id: 1, fecha: 1 });
