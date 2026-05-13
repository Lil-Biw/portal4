import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProyectoSchema } from './proyectos.schema';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Proyecto', schema: ProyectoSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
    ]),
  ],
  controllers: [ProyectosController],
  providers: [ProyectosService],
  exports: [ProyectosService],
})
export class ProyectosModule {}
