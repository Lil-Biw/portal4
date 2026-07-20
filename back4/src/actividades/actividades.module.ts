import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActividadSchema } from './actividades.schema';
import { DocActividadSchema } from './doc-actividad.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
import { ActividadesController, ActividadesAdminController, ActividadesEmpresaController } from './actividades.controller';
import { ActividadesService } from './actividades.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { ActivoSchema } from '../activos/activos.schema';
import { MailModule } from '../mail/mail.module';
import { RecordatoriosModule } from '../recordatorios/recordatorios.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Actividad', schema: ActividadSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
      { name: 'Activo', schema: ActivoSchema },
      { name: 'DocActividad', schema: DocActividadSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
    ]),
    MailModule,
    RecordatoriosModule,
  ],
  controllers: [ActividadesController, ActividadesAdminController, ActividadesEmpresaController],
  providers: [ActividadesService],
  exports: [ActividadesService],
})
export class ActividadesModule {}
