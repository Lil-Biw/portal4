import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CentroCostoSchema } from './centros-costos.schema';
import { CentrosCostosController } from './centros-costos.controller';
import { CentrosCostosService } from './centros-costos.service';
import { PermisoSchema } from '../permisos/permisos.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'CentroCosto', schema: CentroCostoSchema }]),
    MongooseModule.forFeature([{ name: 'Permiso', schema: PermisoSchema }]),
  ],
  controllers: [CentrosCostosController],
  providers: [CentrosCostosService],
  exports: [CentrosCostosService],
})
export class CentrosCostosModule {}
