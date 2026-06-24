import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProyectoSchema } from './proyectos.schema';
import { ProyectosController, ProyectosAdminController, ProyectosEmpresaController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Proyecto', schema: ProyectoSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
    ]),
    DocumentosVencidosModule,
  ],
  controllers: [ProyectosController, ProyectosAdminController, ProyectosEmpresaController],
  providers: [ProyectosService],
  exports: [ProyectosService],
})
export class ProyectosModule {}
