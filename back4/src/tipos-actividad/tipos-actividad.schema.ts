import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TipoActividadDocument = TipoActividad & Document;

@Schema({ collection: 'tipos_actividad', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoActividad {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#4E9AC7', match: /^#[0-9A-Fa-f]{6}$/ }) color: string;
  @Prop({ required: true, default: 'calendario' }) icono: string;
  @Prop({ trim: true }) descripcion?: string;
}

export const TipoActividadSchema = SchemaFactory.createForClass(TipoActividad);
