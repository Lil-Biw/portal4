import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface DocActivo {
  nombre: string;
  nombre_display: string;
  tamano_bytes: number;
  tipo_mime: string;
  contenido?: Buffer;
}

export type ActivoDocument = Activo & Document;

@Schema({ collection: 'activos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Activo {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoActivo', required: true }) tipo_activo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ default: true }) activo: boolean;
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
  documentos: DocActivo[];
}

export const ActivoSchema = SchemaFactory.createForClass(Activo);
ActivoSchema.index({ centro_costo_id: 1, activo: 1 });
ActivoSchema.index({ tipo_activo_id: 1 });
