import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordatorioSchema } from './recordatorios.schema';
import { RecordatoriosService } from './recordatorios.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Recordatorio', schema: RecordatorioSchema }])],
  providers: [RecordatoriosService],
  exports: [RecordatoriosService],
})
export class RecordatoriosModule {}
