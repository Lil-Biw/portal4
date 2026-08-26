import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SugerenciaNewsletterDocument = SugerenciaNewsletter & Document;

@Schema({
  collection: 'newsletter_sugerencias',
  timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' },
})
export class SugerenciaNewsletter {
  @Prop({ required: true, trim: true }) mensaje: string;
  @Prop({ default: 'Otro', trim: true }) categoria: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true }) autor_id: Types.ObjectId;
  @Prop({ default: true }) activo: boolean;
}

export const SugerenciaNewsletterSchema = SchemaFactory.createForClass(SugerenciaNewsletter);
SugerenciaNewsletterSchema.index({ activo: 1, creado_en: -1 });
