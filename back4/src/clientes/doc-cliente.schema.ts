import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocClienteDocument = DocCliente & Document;

@Schema({ collection: 'doc_cliente', timestamps: { createdAt: 'creado_en' } })
export class DocCliente {
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer }) contenido?: Buffer;
  @Prop() s3_key?: string;
  @Prop() categoria?: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) subido_por?: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}

export const DocClienteSchema = SchemaFactory.createForClass(DocCliente);
DocClienteSchema.index({ cliente_id: 1 });
