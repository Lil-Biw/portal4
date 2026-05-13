import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PermisoDocument = Permiso & Document;

@Schema({ collection: 'permisos', timestamps: { createdAt: 'creado_en' } })
export class Permiso {
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true }) usuario_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ enum: ['ver', 'editar'], required: true }) tipo: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true }) asignado_por: Types.ObjectId;
}

export const PermisoSchema = SchemaFactory.createForClass(Permiso);
PermisoSchema.index({ usuario_id: 1, centro_costo_id: 1 }, { unique: true });
PermisoSchema.index({ centro_costo_id: 1, tipo: 1 });
PermisoSchema.index({ cliente_id: 1 });
