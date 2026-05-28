import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MantencionSchema } from './mantenciones.schema';
import { MantencionesController } from './mantenciones.controller';
import { MantencionesService } from './mantenciones.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Mantencion', schema: MantencionSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
    MailModule,
  ],
  controllers: [MantencionesController],
  providers: [MantencionesService],
  exports: [MantencionesService],
})
export class MantencionesModule {}
