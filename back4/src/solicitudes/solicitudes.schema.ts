import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SolicitudDocument = Solicitud & Document;

@Schema({ collection: 'solicitudes', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Solicitud {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, trim: true }) tipo: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) empresa_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto' }) centro_costo_id?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Proyecto' }) proyecto_id?: Types.ObjectId;
  @Prop({ enum: ['pendiente', 'revision', 'aprobado', 'rechazado', 'vencido'], default: 'pendiente' }) estado: string;
  @Prop({ trim: true }) archivo_nombre?: string;
  @Prop({ trim: true }) archivo_url?: string;
}

export const SolicitudSchema = SchemaFactory.createForClass(Solicitud);
SolicitudSchema.index({ empresa_id: 1, estado: 1 });
SolicitudSchema.index({ empresa_id: 1, centro_costo_id: 1 });
