import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { asId } from '../../../shared/utils';

@Component({
  selector: 'app-mi-ficha-page',
  standalone: true,
  imports: [NgFor, FormsModule, StatChipComponent],
  templateUrl: './mi-ficha-page.component.html',
})
export class MiFichaPageComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly clientesService = inject(ClientesService);
  protected readonly centrosService  = inject(CentrosService);

  readonly fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  protected empresaId = signal('');

  protected centrosDeEmpresa = computed(() => {
    const id = this.empresaId();
    if (!id) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === id);
  });

  protected empresaSeleccionada = computed(() =>
    this.clientesService.clientes().find(c => c._id === this.empresaId()) ?? null
  );

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
  }

  protected irADocumentos(): void {
    this.router.navigate(['/documentos']);
  }

  readonly metricas: { label: string; valor: string; chipLabel: string; chipVariant: ChipVariant }[] = [
    { label: 'Score documentos',   valor: '78%', chipLabel: 'Bueno',    chipVariant: 'ok'      },
    { label: 'Docs activos',       valor: '14',  chipLabel: 'Al día',   chipVariant: 'ok'      },
    { label: 'Tareas pendientes',  valor: '3',   chipLabel: 'Atención', chipVariant: 'warning' },
    { label: 'Docs vencidos',      valor: '1',   chipLabel: 'Vencido',  chipVariant: 'danger'  },
  ];

  readonly tareas = [
    { titulo: 'Protocolo seguridad 2026',                color: '#ef4444', fecha: 'Vencido' },
    { titulo: 'Confirmar recepción informe eléctrico',   color: '#f59e0b', fecha: 'Hoy'     },
    { titulo: 'Subir boleta consumo mayo',               color: '#0095d6', fecha: '5 may'   },
  ];

  readonly mantenciones: { titulo: string; detalle: string; chipLabel: string; chipVariant: ChipVariant }[] = [
    { titulo: 'Revisión tablero principal',  detalle: '7 may 2026 · Planta Norte',  chipLabel: 'Esta semana', chipVariant: 'warning' },
    { titulo: 'Auditoría eléctrica anual',   detalle: '18 jun 2026 · Planta Norte', chipLabel: 'Próximo',     chipVariant: 'neutral' },
    { titulo: 'Termografía instalaciones',   detalle: '2 ago 2026 · Bodega Sur',    chipLabel: 'Próximo',     chipVariant: 'neutral' },
  ];

  readonly novedades: { tipo: string; titulo: string; fecha: string; chipVariant: ChipVariant }[] = [
    { tipo: 'Normativa',      titulo: 'Nueva resolución SEC tableros 2026',       fecha: '28 abr 2026', chipVariant: 'ok' },
    { tipo: 'Recomendación',  titulo: 'Checklist previo a auditorías eléctricas', fecha: '15 abr 2026', chipVariant: 'ok' },
    { tipo: 'Servicio',       titulo: 'Nuevo servicio: monitoreo energético 24/7', fecha: '2 abr 2026', chipVariant: 'ok' },
  ];
}
