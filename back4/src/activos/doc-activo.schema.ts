import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocActivoDocument = DocActivo & Document;

@Schema({ collection: 'doc_activo', timestamps: { createdAt: 'creado_en' } })
export class DocActivo {
  @Prop({ type: Types.ObjectId, ref: 'Activo', required: true }) activo_id: Types.ObjectId;
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ enum: ['archivo', 'link'], default: 'archivo' }) tipo_contenido: string;
  @Prop() link_url?: string;
  @Prop() tipo_mime?: string;
  @Prop() tamano_bytes?: number;
  @Prop({ type: Buffer }) contenido?: Buffer;
  @Prop() s3_key?: string;
  @Prop({ default: Date.now }) subido_en: Date;
}

export const DocActivoSchema = SchemaFactory.createForClass(DocActivo);
DocActivoSchema.index({ activo_id: 1 });
