import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocEliminadoDocument = DocEliminado & Document;

@Schema({ collection: 'doc_eliminados', timestamps: { createdAt: 'eliminado_en' } })
export class DocEliminado {
  @Prop({ enum: ['empresa', 'centro', 'activo', 'proyecto', 'actividad'], required: true })
  origen_tipo: string;

  @Prop({ type: Types.ObjectId, required: true }) entidad_id: Types.ObjectId;
  @Prop() entidad_nombre?: string;

  @Prop({ required: true }) nombre_display: string;
  @Prop() categoria?: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer }) contenido?: Buffer;
  @Prop() s3_key?: string;
  @Prop() subido_en?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) eliminado_por?: Types.ObjectId;
}

export const DocEliminadoSchema = SchemaFactory.createForClass(DocEliminado);
DocEliminadoSchema.index({ origen_tipo: 1, entidad_id: 1 });
