import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NewsletterDocument = Newsletter & Document;
export type NewsletterImagenDocument = NewsletterImagen & Document;

export type EstadoNewsletter =
  | 'borrador'
  | 'pendiente_aprobacion'
  | 'aprobado'
  | 'rechazado'
  | 'enviado';

@Schema({ _id: false })
export class BloqueNewsletter {
  @Prop({ required: true, trim: true }) titulo: string;
  @Prop({ required: true, trim: true }) cuerpo: string;
}

export const BloqueNewsletterSchema = SchemaFactory.createForClass(BloqueNewsletter);

@Schema({ collection: 'newsletters', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Newsletter {
  @Prop({ required: true, trim: true }) titulo: string;
  @Prop({ default: '', trim: true }) tagline: string;
  @Prop({ type: [BloqueNewsletterSchema], default: [] }) bloques: BloqueNewsletter[];
  @Prop({
    enum: ['borrador', 'pendiente_aprobacion', 'aprobado', 'rechazado', 'enviado'],
    default: 'borrador',
  }) estado: EstadoNewsletter;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) creado_por?: Types.ObjectId;
  @Prop() enviado_en?: Date;
  @Prop({ default: true }) activo: boolean;

  // Flujo de aprobación
  @Prop({ default: '' }) aprobador_email: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) aprobado_por?: Types.ObjectId;
  @Prop() aprobado_en?: Date;
  @Prop({ default: '' }) motivo_rechazo: string;
}

export const NewsletterSchema = SchemaFactory.createForClass(Newsletter);
NewsletterSchema.index({ activo: 1, estado: 1 });

// Fotos guardadas en colección separada para no romper el límite de 16MB de
// documento MongoDB cuando un newsletter trae varias imágenes.
@Schema({ collection: 'newsletter_imagenes', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class NewsletterImagen {
  @Prop({ type: Types.ObjectId, ref: 'Newsletter', required: true }) newsletter_id: Types.ObjectId;
  @Prop({ required: true }) bloque: number;
  @Prop({ default: 0 }) orden: number;
  @Prop({ required: true }) mimetype: string;
  @Prop({ type: Buffer, required: true }) data: Buffer;
}

export const NewsletterImagenSchema = SchemaFactory.createForClass(NewsletterImagen);
NewsletterImagenSchema.index({ newsletter_id: 1, bloque: 1, orden: 1 });
