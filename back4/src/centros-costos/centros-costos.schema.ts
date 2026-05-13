import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CentroCostoDocument = CentroCosto & Document;

class Documento {
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop() tamano_bytes?: number;
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true }) subido_por: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}

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
  @Prop({ default: true }) activo: boolean;
  @Prop({ type: [Documento], default: [] }) documentos: Documento[];
}

export const CentroCostoSchema = SchemaFactory.createForClass(CentroCosto);
CentroCostoSchema.index({ cliente_id: 1, activo: 1 });
CentroCostoSchema.index({ cliente_id: 1, codigo: 1 }, { unique: true });
