import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProyectoSchema } from './proyectos.schema';
import { DocProyectoSchema } from './doc-proyecto.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
import { ProyectosController, ProyectosAdminController, ProyectosEmpresaController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Proyecto', schema: ProyectoSchema },
      { name: 'DocProyecto', schema: DocProyectoSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
    DocumentosVencidosModule,
    MailModule,
  ],
  controllers: [ProyectosController, ProyectosAdminController, ProyectosEmpresaController],
  providers: [ProyectosService],
  exports: [ProyectosService],
})
export class ProyectosModule {}
