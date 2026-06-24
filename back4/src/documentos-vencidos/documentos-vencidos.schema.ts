import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocumentoVencidoDocument = DocumentoVencido & Document;

@Schema({ collection: 'documentos_vencidos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class DocumentoVencido {
  @Prop({ required: true }) nombre_display: string;
  @Prop({ trim: true }) categoria?: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop() tamano_bytes?: number;
  @Prop({ required: true, enum: ['empresa', 'centro', 'proyecto'] }) origen_tipo: string;
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) empresa_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto' }) centro_id?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Proyecto' }) proyecto_id?: Types.ObjectId;
  @Prop() empresa_nombre?: string;
  @Prop() centro_nombre?: string;
  @Prop() proyecto_nombre?: string;
  @Prop() subido_en?: Date;
  @Prop({ default: Date.now }) vencido_en: Date;
}

export const DocumentoVencidoSchema = SchemaFactory.createForClass(DocumentoVencido);
DocumentoVencidoSchema.index({ empresa_id: 1 });
DocumentoVencidoSchema.index({ vencido_en: -1 });
