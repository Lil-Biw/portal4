import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CentroCostoSchema } from './centros-costos.schema';
import { CentrosCostosController, CentrosCostosAdminController } from './centros-costos.controller';
import { CentrosCostosService } from './centros-costos.service';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
    DocumentosVencidosModule,
    MailModule,
  ],
  controllers: [CentrosCostosController, CentrosCostosAdminController],
  providers: [CentrosCostosService],
  exports: [CentrosCostosService],
})
export class CentrosCostosModule {}
