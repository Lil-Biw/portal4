import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClienteSchema } from './clientes.schema';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Cliente', schema: ClienteSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
    DocumentosVencidosModule,
    MailModule,
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
