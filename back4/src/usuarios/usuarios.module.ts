import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsuarioSchema } from './usuarios.schema';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { PermisosModule } from '../permisos/permisos.module';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Usuario', schema: UsuarioSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
    ]),
    PermisosModule,
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService, MongooseModule],
})
export class UsuariosModule {}
