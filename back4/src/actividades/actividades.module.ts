import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActividadSchema } from './actividades.schema';
import { ActividadesController } from './actividades.controller';
import { ActividadesAdminController } from './actividades-admin.controller';
import { ActividadesEmpresaController } from './actividades-empresa.controller';
import { ActividadesService } from './actividades.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { ActivoSchema } from '../activos/activos.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Actividad', schema: ActividadSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
      { name: 'Activo', schema: ActivoSchema },
    ]),
    MailModule,
  ],
  controllers: [ActividadesController, ActividadesAdminController, ActividadesEmpresaController],
  providers: [ActividadesService],
  exports: [ActividadesService],
})
export class ActividadesModule {}
