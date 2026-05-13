import { Module } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { DocumentosController } from './documentos.controller';
import { CentrosCostosModule } from '../centros-costos/centros-costos.module';
import { ProyectosModule } from '../proyectos/proyectos.module';

@Module({
  imports: [CentrosCostosModule, ProyectosModule],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
