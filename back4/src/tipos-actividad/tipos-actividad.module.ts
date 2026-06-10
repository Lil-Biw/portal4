import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TipoActividadSchema } from './tipos-actividad.schema';
import { TiposActividadController } from './tipos-actividad.controller';
import { TiposActividadService } from './tipos-actividad.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'TipoActividad', schema: TipoActividadSchema }]),
  ],
  controllers: [TiposActividadController],
  providers: [TiposActividadService],
  exports: [TiposActividadService],
})
export class TiposActividadModule {}
