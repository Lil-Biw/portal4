import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type RolDocument = Rol & Document;

@Schema({ collection: 'roles', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Rol {
  @Prop({ required: true, trim: true, unique: true }) nombre: string;
  @Prop({ type: SchemaTypes.Mixed, default: {} }) permisos: Record<string, Record<string, boolean>>;
}

export const RolSchema = SchemaFactory.createForClass(Rol);
