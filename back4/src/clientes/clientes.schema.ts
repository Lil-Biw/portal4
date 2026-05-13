import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ClienteDocument = Cliente & Document;

@Schema({ collection: 'clientes', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Cliente {
  @Prop({ required: true, trim: true }) razon_social: string;
  @Prop({ required: true, unique: true, trim: true }) rut: string;
  @Prop({ required: true, lowercase: true, trim: true }) email_contacto: string;
  @Prop({ trim: true }) telefono?: string;
  @Prop({
    type: {
      calle: String,
      ciudad: String,
      region: String,
      pais: { type: String, default: 'Chile' },
    },
  })
  direccion?: {
    calle?: string;
    ciudad?: string;
    region?: string;
    pais?: string;
  };
  @Prop({ default: true }) activo: boolean;
}

export const ClienteSchema = SchemaFactory.createForClass(Cliente);
ClienteSchema.index({ activo: 1 });
