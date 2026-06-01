import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NoticiaDocument = Noticia & Document;

export type SeccionNoticia = 'novedades' | 'normativas' | 'anuncios';

@Schema({ collection: 'noticias', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Noticia {
  @Prop({ required: true, trim: true }) titulo: string;
  @Prop({ required: true, trim: true }) enlace: string;
  @Prop({ required: true, trim: true }) resumen: string;
  @Prop({ enum: ['novedades', 'normativas', 'anuncios'], required: true }) seccion: SeccionNoticia;
  @Prop({ default: '' }) imagen_url: string;
  @Prop({ type: Buffer, default: null }) imagen_data: Buffer | null;
  @Prop({ default: '' }) imagen_mimetype: string;
  @Prop({ default: true }) activo: boolean;
}

export const NoticiaSchema = SchemaFactory.createForClass(Noticia);
NoticiaSchema.index({ seccion: 1, activo: 1 });
