import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentoVencidoSchema } from './documentos-vencidos.schema';
import { DocumentosVencidosController } from './documentos-vencidos.controller';
import { DocumentosVencidosService } from './documentos-vencidos.service';
import { UsuarioSchema } from '../usuarios/usuarios.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: 'DocumentoVencido', schema: DocumentoVencidoSchema },
    { name: 'Usuario', schema: UsuarioSchema },
  ])],
  controllers: [DocumentosVencidosController],
  providers: [DocumentosVencidosService],
  exports: [DocumentosVencidosService],
})
export class DocumentosVencidosModule {}
