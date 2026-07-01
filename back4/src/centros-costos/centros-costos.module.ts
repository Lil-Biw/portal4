import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CentroCostoSchema } from './centros-costos.schema';
import { DocCentroCostoSchema } from './doc-centro-costo.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
import { CentrosCostosController, CentrosCostosAdminController } from './centros-costos.controller';
import { CentrosCostosService } from './centros-costos.service';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'DocCentroCosto', schema: DocCentroCostoSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
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
