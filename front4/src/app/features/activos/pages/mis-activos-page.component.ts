import { Component, OnInit, inject, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivosService } from '../activos.service';
import { CentrosService } from '../../centros/centros.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { ActivosListComponent } from '../components/activos-list/activos-list.component';
import { asId } from '../../../shared/utils';

@Component({
  selector: 'app-mis-activos-page',
  standalone: true,
  imports: [FormsModule, ActivosListComponent],
  template: `
    <div class="page-header">
      <h2>Mis activos</h2>
      @if (busquedaVisible()) {
        <input
          class="search-input"
          type="text"
          placeholder="Nombre o tipo..."
          [ngModel]="busqueda()"
          (ngModelChange)="busqueda.set($event)"
          autofocus />
      }
      <button class="btn-ghost" (click)="busquedaVisible.set(!busquedaVisible())">
        {{ busquedaVisible() ? 'Cerrar' : 'Buscar' }}
      </button>
    </div>

    @if (service.loading()) {
      <p class="empty">Cargando activos...</p>
    } @else {
      <app-activos-list
        [activos]="activosFiltrados()"
        [centros]="centrosService.centros()"
        [clientes]="clientes()"
        [mostrarAcciones]="false">
      </app-activos-list>
    }
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      gap: .6rem;
      margin-bottom: 1.25rem;
    }
    .page-header h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #1f2937; flex: 1; }
    .search-input {
      padding: .55rem .9rem;
      border-radius: 8px;
      border: 1px solid rgba(34,33,33,.2);
      font-size: .9rem;
      font-family: inherit;
      width: 220px;
      box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: #0095d6; }
  `],
})
export class MisActivosPageComponent implements OnInit {
  protected readonly service       = inject(ActivosService);
  protected readonly centrosService = inject(CentrosService);
  private   readonly ctx           = inject(ConsumidorContextService);

  protected busqueda        = signal('');
  protected busquedaVisible = signal(false);

  protected clientes = computed(() => {
    const empresa = this.ctx.empresaSeleccionada();
    return empresa ? [empresa] : [];
  });

  private centroIdsPorEmpresa = computed((): Set<string> => {
    const empresa = this.ctx.empresaSeleccionada();
    if (!empresa) return new Set();
    return new Set(
      this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(empresa._id))
        .map(c => asId(c._id))
    );
  });

  protected activosFiltrados = computed(() => {
    const q    = this.busqueda().toLowerCase().trim();
    const ids  = this.centroIdsPorEmpresa();
    let list   = this.service.activos().filter(a => ids.has(asId(a.centro_costo_id)));
    if (q) list = list.filter(a => a.nombre.toLowerCase().includes(q) || a.tipo_activo.toLowerCase().includes(q));
    return list;
  });

  constructor() {
    effect(() => {
      const empresa = this.ctx.empresaSeleccionada();
      if (!empresa) { this.service.activos.set([]); return; }
      const id = asId(empresa._id);
      this.centrosService.cargarPorEmpresa(id);
    });

    effect(() => {
      const empresa  = this.ctx.empresaSeleccionada();
      const centroIds = [...this.centroIdsPorEmpresa()];
      if (empresa && centroIds.length > 0) {
        this.service.cargarPorCentros(asId(empresa._id), centroIds);
      }
    });
  }

  ngOnInit(): void {}
}
