import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SolicitudSchema } from './solicitudes.schema';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { ClienteSchema } from '../clientes/clientes.schema';
import { ProyectoSchema } from '../proyectos/proyectos.schema';
import { DocCentroCostoSchema } from '../centros-costos/doc-centro-costo.schema';
import { DocClienteSchema } from '../clientes/doc-cliente.schema';
import { DocProyectoSchema } from '../proyectos/doc-proyecto.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { PermisoSchema } from '../permisos/permisos.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Solicitud', schema: SolicitudSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'Cliente', schema: ClienteSchema },
      { name: 'Proyecto', schema: ProyectoSchema },
      { name: 'DocCentroCosto', schema: DocCentroCostoSchema },
      { name: 'DocCliente', schema: DocClienteSchema },
      { name: 'DocProyecto', schema: DocProyectoSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
      { name: 'Permiso', schema: PermisoSchema },
    ]),
    MailModule,
  ],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
