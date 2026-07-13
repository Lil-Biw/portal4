import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocProyectoDocument = DocProyecto & Document;

@Schema({ collection: 'doc_proyecto', timestamps: { createdAt: 'creado_en' } })
export class DocProyecto {
  @Prop({ type: Types.ObjectId, ref: 'Proyecto', required: true }) proyecto_id: Types.ObjectId;
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

export const DocProyectoSchema = SchemaFactory.createForClass(DocProyecto);
DocProyectoSchema.index({ proyecto_id: 1 });
