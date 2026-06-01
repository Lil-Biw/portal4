import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivoSchema } from './activos.schema';
import { ActivosController } from './activos.controller';
import { ActivosAdminController } from './activos-admin.controller';
import { ActivosService } from './activos.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Activo', schema: ActivoSchema }])],
  controllers: [ActivosController, ActivosAdminController],
  providers: [ActivosService],
  exports: [ActivosService],
})
export class ActivosModule {}
