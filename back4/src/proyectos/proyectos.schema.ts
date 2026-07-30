import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

export type ProyectoDocument = Proyecto & Document;

@Schema({ collection: 'proyectos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Proyecto {
  // OJO: dentro de un array, el tipo debe ser SchemaTypes.ObjectId; con Types.ObjectId
  // el SchemaFactory de Nest lo degrada a Mixed sin ref y populate() no hace nada.
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'CentroCosto' }], required: true }) centro_costo_ids: Types.ObjectId[];
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'TipoProyecto' }) tipo_proyecto_id?: Types.ObjectId;
  @Prop({ required: true, trim: true }) codigo: string;
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({
    enum: [
      'estancado', 'nuevo_sin_oc', 'nuevo_con_oc', 'en_ejecucion',
      'cierre_pendiente', 'finalizado_facturar', 'finalizado_facturado',
      // 'eliminado': sentinel interno para soft-delete (ver ProyectosService.remove),
      // no se expone en los DTOs ni en los filtros de la UI.
      'eliminado',
    ],
    default: 'nuevo_sin_oc',
  }) estado: string;
  @Prop() fecha_inicio?: Date;
  @Prop() fecha_fin?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) creado_por?: Types.ObjectId;
}

export const ProyectoSchema = SchemaFactory.createForClass(Proyecto);
ProyectoSchema.index({ centro_costo_ids: 1, estado: 1 });
ProyectoSchema.index({ cliente_id: 1, estado: 1 });
ProyectoSchema.index({ centro_costo_ids: 1, codigo: 1 }, { unique: true });
ProyectoSchema.index({ tipo_proyecto_id: 1 });
