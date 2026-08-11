import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export type ActividadDocument = Actividad & Document;

@Schema({ collection: 'actividades', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Actividad {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoActividad', required: true }) tipo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  // OJO: dentro de un array, el tipo debe ser SchemaTypes.ObjectId; con Types.ObjectId
  // el SchemaFactory de Nest lo degrada a Mixed sin ref y populate() no hace nada.
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'Activo' }], default: [] }) activo_ids: Types.ObjectId[];
  @Prop({ required: true }) fecha: Date;
  @Prop() fecha_termino?: Date;
  @Prop({ match: /^([01]\d|2[0-3]):[0-5]\d$/ }) hora?: string;
  @Prop({ match: /^([01]\d|2[0-3]):[0-5]\d$/ }) hora_termino?: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) creado_por?: Types.ObjectId;
  @Prop() creado_por_nombre?: string;
  @Prop() creado_por_email?: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) lider_id?: Types.ObjectId;
  @Prop() lider_nombre?: string;
  @Prop() lider_email?: string;
}

export const ActividadSchema = SchemaFactory.createForClass(Actividad);
ActividadSchema.index({ centro_costo_id: 1, fecha: 1 });
