import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProyectoDocument = Proyecto & Document;

class Documento {
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop() tamano_bytes?: number;
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: false }) subido_por?: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}

@Schema({ collection: 'proyectos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Proyecto {
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ required: true, trim: true }) codigo: string;
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ enum: ['borrador', 'activo', 'cerrado'], default: 'borrador' }) estado: string;
  @Prop() fecha_inicio?: Date;
  @Prop() fecha_fin?: Date;
  @Prop({ type: [Documento], default: [] }) documentos: Documento[];
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: false }) creado_por?: Types.ObjectId;
}

export const ProyectoSchema = SchemaFactory.createForClass(Proyecto);
ProyectoSchema.index({ centro_costo_id: 1, estado: 1 });
ProyectoSchema.index({ cliente_id: 1, estado: 1 });
ProyectoSchema.index({ centro_costo_id: 1, codigo: 1 }, { unique: true });
