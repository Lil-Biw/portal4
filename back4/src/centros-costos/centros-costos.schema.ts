import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CentroCostoDocument = CentroCosto & Document;

@Schema({ collection: 'centros_costos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class CentroCosto {
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ required: true, trim: true }) codigo: string;
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ trim: true }) ubicacion_direccion?: string;
  @Prop({ trim: true }) ubicacion_ciudad?: string;
  @Prop({ trim: true }) ubicacion_region?: string;
  @Prop({ trim: true }) ubicacion_pais?: string;
  @Prop() ubicacion_latitud?: number;
  @Prop() ubicacion_longitud?: number;
  @Prop({ default: true }) activo: boolean;
  @Prop({ type: [Number], default: [5, 5, 5, 5, 5] }) score_smartclarity: number[];
}

export const CentroCostoSchema = SchemaFactory.createForClass(CentroCosto);
CentroCostoSchema.index({ cliente_id: 1, activo: 1 });
CentroCostoSchema.index({ cliente_id: 1, codigo: 1 }, { unique: true });
