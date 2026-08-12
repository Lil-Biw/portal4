import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export type UsuarioDocument = Usuario & Document;

@Schema({ collection: 'usuarios', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Usuario {
  @Prop({ type: Types.ObjectId, ref: 'Cliente' }) cliente_id?: Types.ObjectId;
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true, select: false }) password_hash: string;
  @Prop({ enum: ['super_admin', 'admin_smartclarity', 'usuario'], default: 'usuario' }) rol: string;
  @Prop({ enum: ['ver', 'editar'], default: 'ver' }) permiso_acceso: string;
  // OJO: dentro de un array, el tipo debe ser SchemaTypes.ObjectId; con Types.ObjectId
  // el SchemaFactory de Nest lo degrada a Mixed sin ref y populate() no hace nada.
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'CentroCosto' }], default: [] }) centros_asignados: Types.ObjectId[];
  @Prop({ type: SchemaTypes.Mixed, default: {} }) permisos: Record<string, Record<string, boolean>>;
  @Prop({ default: true }) debe_cambiar_password: boolean;
  @Prop({ default: true }) activo: boolean;
  @Prop() ultimo_acceso?: Date;

  // Suscripción a notificaciones de admins (admin_smartclarity / super_admin):
  // documento subido/vencido, solicitud completada, proyecto por vencer/cerrado, actividad próxima
  @Prop({ default: true }) notificar_todas_empresas: boolean;
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'Cliente' }], default: [] }) empresas_suscritas: Types.ObjectId[];
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'CentroCosto' }], default: [] }) centros_suscritos: Types.ObjectId[];
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'Proyecto' }], default: [] }) proyectos_suscritos: Types.ObjectId[];
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
UsuarioSchema.index({ cliente_id: 1, activo: 1 });
