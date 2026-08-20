import { Component, computed, inject, OnInit } from '@angular/core';
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

    @if (service.loading()) {
      <div class="empty">Cargando...</div>
    } @else {
      @for (sec of secciones; track sec.value) {
        <section class="seccion">
          <div class="seccion-header" [style.--sec-color]="sec.color">
            <span class="seccion-dot"></span>
            <h3 class="seccion-titulo">{{ sec.label }}</h3>
          </div>

          @let items = porSeccion(sec.value);
          @if (items.length === 0) {
            <p class="empty-sec">No hay {{ sec.labelMin }}s publicadas por el momento.</p>
          } @else {
            <div class="fila">
              @for (n of items; track n._id) {
                <div class="card" (click)="abrirEnlace(n.enlace)">
                  <div class="card-img" [style.background]="gradiente(sec.color)">
                    @if (service.imagenUrl(n); as src) {
                      <img [src]="src" alt="imagen noticia" />
                    }
                  </div>
                  <div class="card-body">
                    <h3 class="card-titulo">{{ n.titulo }}</h3>
                    <p class="card-resumen">{{ n.resumen }}</p>
                    <span class="card-fecha">{{ formatFecha(n.creado_en) }}</span>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }
    }
  `,
  styles: [`
    .header { margin-bottom:1.75rem; }
    .titulo  { margin:0 0 .25rem; font-size:1.5rem; font-weight:700; color:var(--fg-2); }
    .subtitulo { margin:0; font-size:.875rem; color:var(--fg-4); }

    .empty { color:var(--fg-5); font-size:.9rem; padding:2rem 0; text-align:center; }

    .seccion { margin-bottom:2rem; }

    .seccion-header {
      display:flex; align-items:center; gap:.55rem;
      margin-bottom:.9rem;
      padding-bottom:.55rem;
      border-bottom:2px solid var(--sec-color, var(--sc-cyan));
    }
    .seccion-dot {
      width:10px; height:10px; border-radius:50%;
      background:var(--sec-color, var(--sc-cyan));
      flex-shrink:0;
    }
    .seccion-titulo { margin:0; font-size:1rem; font-weight:700; color:var(--fg-2); }

    .empty-sec { color:var(--fg-5); font-size:.85rem; padding:.5rem 0 1rem; margin:0; }

    .fila {
      display:flex;
      flex-direction:row;
      gap:1rem;
      overflow-x:auto;
      padding-bottom:.5rem;
      scrollbar-width:thin;
      scrollbar-color:#d1d5db transparent;
    }
    .card { flex:0 0 420px; }

    .card {
      border-radius:14px;
      border:1px solid var(--border-default);
      background:#fff;
      box-shadow:var(--shadow-1);
      overflow:hidden;
      cursor:pointer;
      display:flex;
      flex-direction:row;
      transition:box-shadow .15s, transform .15s;
    }
    .card:hover { box-shadow:var(--shadow-2); transform:translateY(-2px); }

    .card-img {
      width:110px;
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

    .card-titulo { margin:0; font-size:.93rem; font-weight:700; color:var(--fg-2); line-height:1.3; }
    .card-resumen {
      margin:0; font-size:.8rem; color:var(--fg-4); line-height:1.5; flex:1;
      display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
    }
    .card-fecha { font-size:.75rem; color:var(--fg-5); margin-top:auto; }
  `],
})
export class NoticiasConsumidorPageComponent implements OnInit {
  protected readonly service   = inject(NoticiasService);
  protected readonly secciones = SECCIONES;

  ngOnInit() { this.service.cargar(); }

  porSeccion(seccion: SeccionNoticia) {
    return this.service.noticias().filter(n => n.seccion === seccion);
  }

  gradiente(color: string): string {
    return `linear-gradient(135deg, ${color}cc 0%, ${color}88 100%)`;
  }

  abrirEnlace(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  formatFecha(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
