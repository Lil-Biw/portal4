import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface DocActividad {
  nombre: string;
  nombre_display: string;
  tamano_bytes: number;
  tipo_mime: string;
  contenido?: Buffer;
}

export type ActividadDocument = Actividad & Document;

@Schema({ collection: 'actividades', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Actividad {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoActividad', required: true }) tipo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Activo' }], default: [] }) activo_ids: Types.ObjectId[];
  @Prop({ required: true }) fecha: Date;
  @Prop({
    type: [{
      nombre:         { type: String, required: true },
      nombre_display: { type: String, required: true },
      tamano_bytes:   { type: Number, required: true },
      tipo_mime:      { type: String, required: true },
      contenido:      { type: Buffer, required: true },
    }],
    default: [],
  })
  documentos: DocActividad[];
}

export const ActividadSchema = SchemaFactory.createForClass(Actividad);
ActividadSchema.index({ centro_costo_id: 1, fecha: 1 });
