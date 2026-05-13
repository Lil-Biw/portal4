import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UsuarioDocument = Usuario & Document;

@Schema({ collection: 'usuarios', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Usuario {
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true, select: false }) password_hash: string;
  @Prop({ enum: ['admin_cliente', 'usuario'], default: 'usuario' }) rol: string;
  @Prop({ enum: ['ver', 'editar'], default: 'ver' }) permiso_acceso: string;
  @Prop({ default: true }) activo: boolean;
  @Prop() ultimo_acceso?: Date;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
UsuarioSchema.index({ cliente_id: 1, activo: 1 });
