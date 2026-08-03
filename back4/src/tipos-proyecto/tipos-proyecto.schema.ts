import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TipoProyectoDocument = TipoProyecto & Document;

@Schema({ collection: 'tipos_proyecto', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoProyecto {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#0095d6', match: /^#[0-9A-Fa-f]{6}$/ }) color: string;
  @Prop({ required: true, default: 'calendario' }) icono: string;
}

export const TipoProyectoSchema = SchemaFactory.createForClass(TipoProyecto);
