import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermisoSchema } from './permisos.schema';
import { PermisosController } from './permisos.controller';
import { PermisosService } from './permisos.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Permiso', schema: PermisoSchema }]),
  ],
  controllers: [PermisosController],
  providers: [PermisosService],
  exports: [PermisosService],
})
export class PermisosModule {}
