import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NoticiaDocument = Noticia & Document;

@Schema({ collection: 'noticias', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Noticia {
  @Prop({ required: true, trim: true }) titulo: string;
  @Prop({ required: true, trim: true }) enlace: string;
  @Prop({ required: true, trim: true }) resumen: string;
  @Prop({ default: '' }) imagen_url: string;
  @Prop({ default: true }) activo: boolean;
}

export const NoticiaSchema = SchemaFactory.createForClass(Noticia);
