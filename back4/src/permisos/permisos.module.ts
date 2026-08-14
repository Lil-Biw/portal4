import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermisoSchema } from './permisos.schema';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { PermisosController } from './permisos.controller';
import { PermisosService } from './permisos.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Permiso', schema: PermisoSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
    ]),
  ],
  controllers: [PermisosController],
  providers: [PermisosService],
  exports: [PermisosService],
})
export class PermisosModule {}
