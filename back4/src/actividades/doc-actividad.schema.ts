import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocActividadDocument = DocActividad & Document;

@Schema({ collection: 'doc_actividad', timestamps: { createdAt: 'creado_en' } })
export class DocActividad {
  @Prop({ type: Types.ObjectId, ref: 'Actividad', required: true }) actividad_id: Types.ObjectId;
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

export const DocActividadSchema = SchemaFactory.createForClass(DocActividad);
DocActividadSchema.index({ actividad_id: 1 });
