import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivoSchema } from './activos.schema';
import { ActivosController } from './activos.controller';
import { ActivosAdminController } from './activos-admin.controller';
import { ActivosService } from './activos.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { TipoActivoSchema } from '../tipos-activo/tipos-activo.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: 'Activo', schema: ActivoSchema },
    { name: 'CentroCosto', schema: CentroCostoSchema },
    { name: 'TipoActivo', schema: TipoActivoSchema },
  ])],
  controllers: [ActivosController, ActivosAdminController],
  providers: [ActivosService],
  exports: [ActivosService],
})
export class ActivosModule {}
