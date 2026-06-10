import { Component, signal } from '@angular/core';

interface FaqItem { pregunta: string; respuesta: string; abierto: boolean; }
interface Guia    { icono: string; titulo: string; pasos: string[]; }

@Component({
  selector: 'app-ayuda-page',
  standalone: true,
  imports: [],
  template: `
    <!-- Header -->
    <div style="margin-bottom:1.5rem">
      <h2 style="margin:0 0 .25rem;font-size:1.5rem;font-weight:700;color:#1f2937">Centro de ayuda</h2>
      <p style="margin:0;font-size:.875rem;color:#6b7280">Todo lo que necesitas saber para usar el portal</p>
    </div>

    <!-- Búsqueda rápida + accesos directos -->
    <div class="card" style="margin-bottom:1rem;background:linear-gradient(135deg,#0095d6 0%,#0369a1 100%);border:none">
      <p style="margin:0 0 .5rem;font-size:1.05rem;font-weight:700;color:#fff">¿En qué podemos ayudarte?</p>
      <p style="margin:0 0 1rem;font-size:.85rem;color:rgba(255,255,255,.8)">Encuentra guías, respuestas y contacto directo con soporte SmartClarity.</p>
      <div style="display:flex;gap:.65rem;flex-wrap:wrap">
        @for (a of accesos; track a.label) {
          <button
            style="display:flex;align-items:center;gap:.4rem;padding:.45rem .85rem;border-radius:8px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s"
            (click)="scrollTo(a.id)">
            <span [innerHTML]="a.icono"></span>{{ a.label }}
          </button>
        }
      </div>
    </div>

    <!-- Guías de uso -->
    <h3 id="guias" style="margin:0 0 .85rem;font-size:1rem;font-weight:700;color:#1f2937">Guías de uso rápido</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.85rem;margin-bottom:1.5rem">
      @for (g of guias; track g.titulo) {
        <div class="card" style="padding:1rem">
          <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.75rem">
            <div style="width:36px;height:36px;border-radius:9px;background:rgba(0,149,214,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0"
                 [innerHTML]="g.icono"></div>
            <h4 style="margin:0;font-size:.9rem;font-weight:700;color:#1f2937">{{ g.titulo }}</h4>
          </div>
          <ol style="margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:.35rem">
            @for (paso of g.pasos; track paso) {
              <li style="font-size:.78rem;color:#6b7280;line-height:1.45">{{ paso }}</li>
            }
          </ol>
        </div>
      }
    </div>

    <!-- FAQ -->
    <h3 id="faq" style="margin:0 0 .85rem;font-size:1rem;font-weight:700;color:#1f2937">Preguntas frecuentes</h3>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:1.5rem">
      @for (item of faq(); track item.pregunta; let last = $last) {
        <div [style.border-bottom]="last ? 'none' : '1px solid rgba(34,33,33,.07)'">
          <button
            style="width:100%;text-align:left;background:none;border:none;padding:.85rem 1rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:.75rem;font-family:inherit"
            (click)="toggleFaq(item)">
            <span style="font-size:.875rem;font-weight:600;color:#1f2937">{{ item.pregunta }}</span>
            <span style="font-size:1.1rem;color:#9ca3af;flex-shrink:0;transition:transform .2s"
                  [style.transform]="item.abierto ? 'rotate(45deg)' : 'none'">+</span>
          </button>
          @if (item.abierto) {
            <div style="padding:0 1rem .85rem;font-size:.82rem;color:#6b7280;line-height:1.6">
              {{ item.respuesta }}
            </div>
          }
        </div>
      }
    </div>

    <!-- Contacto de soporte -->
    <h3 id="contacto" style="margin:0 0 .85rem;font-size:1rem;font-weight:700;color:#1f2937">Contacto de soporte</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.85rem">
      @for (c of contactos; track c.titulo) {
        <div class="card" style="display:flex;flex-direction:column;gap:.4rem">
          <div style="display:flex;align-items:center;gap:.55rem;margin-bottom:.2rem">
            <div style="width:32px;height:32px;border-radius:8px;background:rgba(0,149,214,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0"
                 [innerHTML]="c.icono"></div>
            <h4 style="margin:0;font-size:.88rem;font-weight:700;color:#1f2937">{{ c.titulo }}</h4>
          </div>
          <p style="margin:0;font-size:.8rem;color:#6b7280">{{ c.descripcion }}</p>
          <a [href]="c.href" target="_blank" rel="noopener"
             style="margin-top:.2rem;font-size:.82rem;font-weight:600;color:#0095d6;text-decoration:none">
            {{ c.accion }}
          </a>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display:block; }
  `],
})
export class AyudaPageComponent {
  readonly accesos = [
    { label: 'Guías',    id: 'guias',    icono: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
    { label: 'FAQ',      id: 'faq',      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
    { label: 'Contacto', id: 'contacto', icono: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' },
  ];

  readonly guias: Guia[] = [
    {
      titulo: 'Seleccionar empresa',
      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0095d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="9" width="7" height="12"/><path d="M10 3h4v4h-4z"/></svg>',
      pasos: [
        'Haz clic en el selector de empresa en la barra superior.',
        'Elige tu empresa de la lista desplegable.',
        'El portal cargará todos los datos de esa empresa.',
      ],
    },
    {
      titulo: 'Ver score documental',
      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0095d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      pasos: [
        'Navega a "Inicio" o "Mi ficha".',
        'El score muestra el % de documentos aprobados sobre el total solicitado.',
        'Verde = bueno · Amarillo = regular · Rojo = bajo.',
      ],
    },
    {
      titulo: 'Subir documentos',
      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0095d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      pasos: [
        'Entra a "Documentos" en el menú lateral.',
        'Selecciona el centro de costos o proyecto.',
        'Usa el botón "Cargar documento" para subir archivos PDF.',
      ],
    },
    {
      titulo: 'Gestionar solicitudes',
      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0095d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
      pasos: [
        'En "Documentos" selecciona la pestaña "Solicitudes".',
        'Las solicitudes pendientes requieren que adjuntes el archivo correspondiente.',
        'Las solicitudes rechazadas también permiten re-subir el documento.',
      ],
    },
    {
      titulo: 'Ver actividades',
      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0095d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
      pasos: [
        'En "Actividades" verás un calendario con las fechas programadas.',
        'Las actividades próximas también aparecen en tu panel de Inicio.',
        'Contacta a soporte si una actividad no está registrada.',
      ],
    },
    {
      titulo: 'Revisar proyectos',
      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0095d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      pasos: [
        'Entra a "Proyectos" para ver todos los proyectos de tu empresa.',
        'Haz clic en un proyecto para ver su información detallada y score.',
        'Desde el detalle puedes ir directamente a documentación y solicitudes.',
      ],
    },
  ];

  readonly faq = signal<FaqItem[]>([
    {
      pregunta: '¿Cómo interpreto el score documental?',
      respuesta: 'El score refleja el porcentaje de solicitudes documentales aprobadas respecto al total. Un 80% o más es considerado bueno. Entre 50% y 79% es regular y requiere atención. Menos del 50% indica que hay muchos documentos pendientes o con problemas.',
      abierto: false,
    },
    {
      pregunta: '¿Qué hago si un documento fue rechazado?',
      respuesta: 'Ve a "Documentos" → pestaña "Solicitudes". Filtra por estado "rechazado". Haz clic en la solicitud correspondiente y adjunta la versión corregida del documento. El equipo de SmartClarity revisará nuevamente y actualizará el estado.',
      abierto: false,
    },
    {
      pregunta: '¿Con qué frecuencia se actualiza la información?',
      respuesta: 'Los datos se actualizan en tiempo real. Cualquier cambio realizado por el equipo de SmartClarity (aprobación, rechazo, nueva solicitud) se refleja inmediatamente al recargar la página o navegar entre secciones.',
      abierto: false,
    },
    {
      pregunta: '¿Puedo ver documentos de varios centros de costos a la vez?',
      respuesta: 'Actualmente la vista de documentos se organiza por centro de costos o proyecto. En el panel de Inicio y en Mi ficha puedes ver un resumen consolidado de todos los centros de tu empresa con sus scores individuales.',
      abierto: false,
    },
    {
      pregunta: '¿Qué significa el estado "en revisión"?',
      respuesta: 'Significa que el documento fue subido correctamente y el equipo de SmartClarity lo está revisando. No se requiere ninguna acción de tu parte. Recibirás la actualización del estado una vez que sea procesado.',
      abierto: false,
    },
    {
      pregunta: '¿Cómo cambio la empresa visualizada?',
      respuesta: 'Usa el selector de empresa en la barra superior del portal. Si no ves el selector, es posible que tu usuario solo tenga acceso a una empresa. Contacta a SmartClarity si necesitas acceso a una empresa adicional.',
      abierto: false,
    },
  ]);

  readonly contactos = [
    {
      titulo: 'Soporte técnico',
      descripcion: 'Problemas con el portal, acceso o errores técnicos.',
      accion: 'soporte@smartclarity.cl',
      href: 'mailto:soporte@smartclarity.cl',
      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0095d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    },
    {
      titulo: 'Consultas documentales',
      descripcion: 'Preguntas sobre solicitudes, documentos o estados.',
      accion: 'documentos@smartclarity.cl',
      href: 'mailto:documentos@smartclarity.cl',
      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0095d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    },
    {
      titulo: 'Teléfono directo',
      descripcion: 'Lunes a viernes · 9:00 – 18:00 hrs.',
      accion: '+56 2 2000 0000',
      href: 'tel:+56220000000',
      icono: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0095d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.26 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.7a16 16 0 0 0 6.08 6.08l1.36-.36a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    },
  ];

  toggleFaq(item: FaqItem): void {
    this.faq.update(list =>
      list.map(i => i === item ? { ...i, abierto: !i.abierto } : i)
    );
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
