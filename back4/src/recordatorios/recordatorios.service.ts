import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RecordatorioDocument } from './recordatorios.schema';

export type TipoRecordatorio = 'proyecto' | 'actividad';

export interface PendientesRecordatorio {
  // diasRestantes < 0 — solo relevante para proyectos (auto-cierre); actividades lo ignora.
  vencidos: Types.ObjectId[];
  // diasRestantes es también el umbral notificado (coincidencia exacta con `dias`).
  porNotificar: { entidadId: Types.ObjectId; diasRestantes: number }[];
}

@Injectable()
export class RecordatoriosService {
  constructor(
    @InjectModel('Recordatorio') private readonly recordatorioModel: Model<RecordatorioDocument>,
  ) {}

  async sincronizar(tipo: TipoRecordatorio, entidadId: Types.ObjectId, dias: number[], fechaFin: Date | null | undefined): Promise<void> {
    if (!fechaFin) {
      await this.eliminar(tipo, entidadId);
      return;
    }
    const actual = await this.recordatorioModel.findOne({ tipo, entidad_id: entidadId }).select('fecha_fin').lean();
    const update: Record<string, unknown> = { $set: { dias, fecha_fin: fechaFin } };
    // Si la fecha límite cambió (se pospuso o adelantó el plazo), el umbral ya
    // notificado deja de ser válido: el conteo de días restantes puede volver a
    // cruzar el mismo umbral bajo la nueva fecha, y sin este reset se suprimiría
    // el aviso porque ultimo_recordatorio_dias todavía coincide con el umbral.
    if (actual?.fecha_fin && new Date(actual.fecha_fin).getTime() !== new Date(fechaFin).getTime()) {
      update.$unset = { ultimo_recordatorio_dias: '' };
    }
    await this.recordatorioModel.updateOne(
      { tipo, entidad_id: entidadId },
      update,
      { upsert: true },
    );
  }

  async eliminar(tipo: TipoRecordatorio, entidadId: Types.ObjectId): Promise<void> {
    await this.recordatorioModel.deleteOne({ tipo, entidad_id: entidadId });
  }

  async obtenerDias(tipo: TipoRecordatorio, entidadId: Types.ObjectId): Promise<number[]> {
    const r = await this.recordatorioModel.findOne({ tipo, entidad_id: entidadId }).select('dias').lean();
    return r?.dias ?? [];
  }

  // Para listados: evita N+1 queries resolviendo los días de varias entidades
  // de una sola vez. Las que no tienen recordatorio configurado no aparecen
  // en el mapa (el llamador debe interpretar la ausencia como []).
  async obtenerDiasBatch(tipo: TipoRecordatorio, entidadIds: Types.ObjectId[]): Promise<Map<string, number[]>> {
    if (!entidadIds.length) return new Map();
    const registros = await this.recordatorioModel
      .find({ tipo, entidad_id: { $in: entidadIds } })
      .select('entidad_id dias')
      .lean();
    return new Map(registros.map(r => [String(r.entidad_id), r.dias ?? []]));
  }

  async evaluarPendientes(tipo: TipoRecordatorio, hoyUtc: number): Promise<PendientesRecordatorio> {
    const recordatorios = await this.recordatorioModel
      .find({ tipo, fecha_fin: { $ne: null } })
      .lean();

    const vencidos: Types.ObjectId[] = [];
    const porNotificar: PendientesRecordatorio['porNotificar'] = [];

    for (const r of recordatorios) {
      const fin = new Date(r.fecha_fin);
      const finUtc = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate());
      const diasRestantes = Math.round((finUtc - hoyUtc) / 86_400_000);

      if (diasRestantes < 0) {
        vencidos.push(r.entidad_id);
        continue;
      }

      // Coincidencia exacta: si el proyecto/actividad se creó o editó con menos
      // días restantes que el umbral más alto configurado (p. ej. 28 en vez de
      // 30), NO se avisa "tarde" con ese número arbitrario — se espera al
      // próximo umbral que sí coincida exactamente (15, 7, ...).
      if (!(r.dias ?? []).includes(diasRestantes)) continue;
      if (diasRestantes === r.ultimo_recordatorio_dias) continue;

      porNotificar.push({ entidadId: r.entidad_id, diasRestantes });
    }

    return { vencidos, porNotificar };
  }

  async marcarNotificado(tipo: TipoRecordatorio, entidadId: Types.ObjectId, diasRestantes: number): Promise<void> {
    await this.recordatorioModel.updateOne({ tipo, entidad_id: entidadId }, { ultimo_recordatorio_dias: diasRestantes });
  }
}
