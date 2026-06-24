import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CentroCostoSchema } from './centros-costos.schema';
import { CentrosCostosController, CentrosCostosAdminController } from './centros-costos.controller';
import { CentrosCostosService } from './centros-costos.service';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'CentroCosto', schema: CentroCostoSchema }]),
    DocumentosVencidosModule,
  ],
  controllers: [CentrosCostosController, CentrosCostosAdminController],
  providers: [CentrosCostosService],
  exports: [CentrosCostosService],
})
export class CentrosCostosModule {}
