import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TipoMantencionDocument = TipoMantencion & Document;

@Schema({ collection: 'tipos_mantencion', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoMantencion {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#0095d6' }) color: string;
  @Prop({ trim: true }) descripcion?: string;
}

export const TipoMantencionSchema = SchemaFactory.createForClass(TipoMantencion);
