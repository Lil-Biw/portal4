import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TipoActivoDocument = TipoActivo & Document;

@Schema({ collection: 'tipos_activo', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoActivo {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#0095d6', match: /^#[0-9A-Fa-f]{6}$/ }) color: string;
  @Prop({ required: true, default: 'herramienta' }) icono: string;
}

export const TipoActivoSchema = SchemaFactory.createForClass(TipoActivo);
