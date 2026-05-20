import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CentroCostoSchema } from './centros-costos.schema';
import { CentrosCostosController } from './centros-costos.controller';
import { CentrosCostosService } from './centros-costos.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'CentroCosto', schema: CentroCostoSchema }]),
  ],
  controllers: [CentrosCostosController],
  providers: [CentrosCostosService],
  exports: [CentrosCostosService],
})
export class CentrosCostosModule {}
