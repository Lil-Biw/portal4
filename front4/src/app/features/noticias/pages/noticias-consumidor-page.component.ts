import { Component, inject, OnInit } from '@angular/core';
import { NoticiasService } from '../noticias.service';
import { SECCIONES, SeccionNoticia } from '../../../shared/models/noticia.model';

@Component({
  selector: 'app-noticias-consumidor-page',
  standalone: true,
  imports: [],
  template: `
    <div class="header">
      <h2 class="titulo">Noticias</h2>
      <p class="subtitulo">Mantente informado con las últimas novedades, normativas y anuncios</p>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      @for (sec of secciones; track sec.value) {
        <button
          class="tab"
          [class.tab--active]="service.seccionActiva() === sec.value"
          [style.--tab-color]="sec.color"
          (click)="service.seccionActiva.set(sec.value)">
          {{ sec.label }}
        </button>
      }
    </div>

    @if (service.loading()) {
      <div class="empty">Cargando...</div>
    } @else if (service.noticiasFiltradas().length === 0) {
      <div class="empty">No hay {{ seccionActual.labelMin }}s publicadas por el momento.</div>
    } @else {
      <div class="grid">
        @for (n of service.noticiasFiltradas(); track n._id) {
          <div class="card" (click)="abrirEnlace(n.enlace)">
            <div class="card-img" [style.background]="gradiente(n.seccion)">
              @if (service.imagenUrl(n); as src) {
                <img [src]="src" alt="imagen noticia" />
              }
            </div>
            <div class="card-body">
              <span class="seccion-badge" [style.color]="colorSeccion(n.seccion)" [style.background]="colorSeccion(n.seccion) + '18'">
                {{ labelSeccion(n.seccion) }}
              </span>
              <h3 class="card-titulo">{{ n.titulo }}</h3>
              <p class="card-resumen">{{ n.resumen }}</p>
              <span class="card-fecha">{{ formatFecha(n.creado_en) }}</span>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .header { margin-bottom:1.25rem; }
    .titulo  { margin:0 0 .25rem; font-size:1.5rem; font-weight:700; color:#1f2937; }
    .subtitulo { margin:0; font-size:.875rem; color:#6b7280; }

    .tabs { display:flex; gap:.5rem; margin-bottom:1.25rem; border-bottom:2px solid #e5e7eb; }
    .tab {
      background:none; border:none; cursor:pointer;
      font-size:.875rem; font-weight:600; color:#6b7280;
      padding:.55rem 1rem;
      border-bottom:2px solid transparent;
      margin-bottom:-2px;
      transition:color .15s, border-color .15s;
    }
    .tab:hover { color:#374151; }
    .tab--active { color:var(--tab-color, #0095d6); border-bottom-color:var(--tab-color, #0095d6); }

    .empty { color:#9ca3af; font-size:.9rem; padding:2rem 0; text-align:center; }

    .grid {
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
      gap:1rem;
    }

    .card {
      border-radius:14px;
      border:1px solid rgba(34,33,33,.1);
      background:#fff;
      box-shadow:0 2px 8px rgba(15,23,42,.05);
      overflow:hidden;
      cursor:pointer;
      display:flex;
      flex-direction:row;
      transition:box-shadow .15s, transform .15s;
    }
    .card:hover { box-shadow:0 4px 16px rgba(15,23,42,.1); transform:translateY(-2px); }

    .card-img {
      width:120px;
      flex-shrink:0;
      border-radius:10px;
      margin:.75rem;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .card-img img { width:100%; height:100%; object-fit:cover; }

    .card-body { flex:1; padding:.75rem .75rem .75rem .25rem; display:flex; flex-direction:column; gap:.35rem; }

    .seccion-badge {
      font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px;
      padding:2px 8px; border-radius:20px; align-self:flex-start;
    }

    .card-titulo { margin:0; font-size:.93rem; font-weight:700; color:#1f2937; line-height:1.3; }
    .card-resumen {
      margin:0; font-size:.8rem; color:#6b7280; line-height:1.5; flex:1;
      display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
    }
    .card-fecha { font-size:.75rem; color:#9ca3af; margin-top:auto; }
  `],
})
export class NoticiasConsumidorPageComponent implements OnInit {
  protected readonly service  = inject(NoticiasService);
  protected readonly secciones = SECCIONES;

  ngOnInit() { this.service.cargar(); }

  get seccionActual() {
    return SECCIONES.find(s => s.value === this.service.seccionActiva())!;
  }

  colorSeccion(seccion: SeccionNoticia): string {
    return SECCIONES.find(s => s.value === seccion)?.color ?? '#0095d6';
  }

  labelSeccion(seccion: SeccionNoticia): string {
    return SECCIONES.find(s => s.value === seccion)?.label ?? seccion;
  }

  gradiente(seccion: SeccionNoticia): string {
    const c = this.colorSeccion(seccion);
    return `linear-gradient(135deg, ${c}cc 0%, ${c}88 100%)`;
  }

  abrirEnlace(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  formatFecha(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
