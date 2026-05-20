import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MantencionSchema } from './mantenciones.schema';
import { MantencionesController } from './mantenciones.controller';
import { MantencionesService } from './mantenciones.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Mantencion', schema: MantencionSchema }]),
  ],
  controllers: [MantencionesController],
  providers: [MantencionesService],
  exports: [MantencionesService],
})
export class MantencionesModule {}
