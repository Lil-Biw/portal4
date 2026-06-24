import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentoVencidoSchema } from './documentos-vencidos.schema';
import { DocumentosVencidosController } from './documentos-vencidos.controller';
import { DocumentosVencidosService } from './documentos-vencidos.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'DocumentoVencido', schema: DocumentoVencidoSchema }])],
  controllers: [DocumentosVencidosController],
  providers: [DocumentosVencidosService],
  exports: [DocumentosVencidosService],
})
export class DocumentosVencidosModule {}
