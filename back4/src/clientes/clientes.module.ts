import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClienteSchema } from './clientes.schema';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Cliente', schema: ClienteSchema }]),
    DocumentosVencidosModule,
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
