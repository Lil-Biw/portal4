import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TipoProyectoSchema } from './tipos-proyecto.schema';
import { TiposProyectoController } from './tipos-proyecto.controller';
import { TiposProyectoService } from './tipos-proyecto.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'TipoProyecto', schema: TipoProyectoSchema }]),
  ],
  controllers: [TiposProyectoController],
  providers: [TiposProyectoService],
  exports: [TiposProyectoService],
})
export class TiposProyectoModule {}
