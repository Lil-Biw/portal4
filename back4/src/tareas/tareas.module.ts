import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProyectosModule } from '../proyectos/proyectos.module';
import { ActividadesModule } from '../actividades/actividades.module';
import { TareasController } from './tareas.controller';
import { TareasService } from './tareas.service';

@Module({
  imports: [ScheduleModule.forRoot(), ProyectosModule, ActividadesModule],
  controllers: [TareasController],
  providers: [TareasService],
})
export class TareasModule {}
