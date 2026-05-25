import { Component, inject, OnInit } from '@angular/core';
import { NoticiasService } from '../noticias.service';

@Component({
  selector: 'app-noticias-consumidor-page',
  standalone: true,
  imports: [],
  template: `
    <div class="header">
      <h2 class="titulo">Noticias</h2>
      <p class="subtitulo">Mantente informado con las últimas novedades y anuncios</p>
    </div>

    @if (service.loading()) {
      <div class="empty">Cargando noticias...</div>
    } @else if (service.noticias().length === 0) {
      <div class="empty">No hay noticias publicadas por el momento.</div>
    } @else {
      <div class="grid">
        @for (n of service.noticias(); track n._id) {
          <div class="card" (click)="abrirEnlace(n.enlace)">
            <div class="card-img">
              @if (service.imagenUrl(n); as src) {
                <img [src]="src" alt="imagen noticia" />
              } @else {
                <div class="img-placeholder"></div>
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
  `,
  styles: [`
    .header { margin-bottom:1.5rem; }
    .titulo  { margin:0 0 .25rem; font-size:1.5rem; font-weight:700; color:#1f2937; }
    .subtitulo { margin:0; font-size:.875rem; color:#6b7280; }

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
      width:140px;
      flex-shrink:0;
      background:linear-gradient(135deg,#1a237e 0%,#283593 40%,#3949ab 100%);
      border-radius:10px;
      margin:.75rem;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .card-img img { width:100%; height:100%; object-fit:cover; }
    .img-placeholder { width:100%; height:100%; background:linear-gradient(135deg,#1a237e,#3949ab); }

    .card-body { flex:1; padding:.75rem .75rem .75rem .25rem; display:flex; flex-direction:column; gap:.4rem; }
    .card-titulo { margin:0; font-size:.95rem; font-weight:700; color:#1f2937; line-height:1.3; }
    .card-resumen { margin:0; font-size:.8rem; color:#6b7280; line-height:1.5; flex:1;
      display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
    .card-fecha { font-size:.75rem; color:#9ca3af; margin-top:auto; }
  `],
})
export class NoticiasConsumidorPageComponent implements OnInit {
  protected readonly service = inject(NoticiasService);

  ngOnInit() { this.service.cargar(); }

  abrirEnlace(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  formatFecha(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
