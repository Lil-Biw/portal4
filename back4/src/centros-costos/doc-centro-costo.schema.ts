import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocCentroCostoDocument = DocCentroCosto & Document;

@Schema({ collection: 'doc_centro_costo', timestamps: { createdAt: 'creado_en' } })
export class DocCentroCosto {
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ enum: ['archivo', 'link'], default: 'archivo' }) tipo_contenido: string;
  @Prop() link_url?: string;
  @Prop() tipo_mime?: string;
  @Prop() tamano_bytes?: number;
  @Prop({ type: Buffer }) contenido?: Buffer;
  @Prop() s3_key?: string;
  @Prop() categoria?: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) subido_por?: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}

export const DocCentroCostoSchema = SchemaFactory.createForClass(DocCentroCosto);
DocCentroCostoSchema.index({ centro_costo_id: 1 });
