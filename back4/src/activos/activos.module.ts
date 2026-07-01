import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivoSchema } from './activos.schema';
import { DocActivoSchema } from './doc-activo.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
import { ActivosController, ActivosAdminController } from './activos.controller';
import { ActivosService } from './activos.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { TipoActivoSchema } from '../tipos-activo/tipos-activo.schema';
import { ActividadesModule } from '../actividades/actividades.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Activo', schema: ActivoSchema },
      { name: 'DocActivo', schema: DocActivoSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'TipoActivo', schema: TipoActivoSchema },
    ]),
    ActividadesModule,
  ],
  controllers: [ActivosController, ActivosAdminController],
  providers: [ActivosService],
  exports: [ActivosService],
})
export class ActivosModule {}
