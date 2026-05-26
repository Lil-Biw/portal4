import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivoDocument = Activo & Document;

@Schema({ collection: 'activos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Activo {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, trim: true }) tipo_activo: string;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ default: true }) activo: boolean;
}

export const ActivoSchema = SchemaFactory.createForClass(Activo);
ActivoSchema.index({ centro_costo_id: 1, activo: 1 });
