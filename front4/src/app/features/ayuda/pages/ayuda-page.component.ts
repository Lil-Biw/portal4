import { Component } from '@angular/core';

@Component({
  selector: 'app-ayuda-page',
  standalone: true,
  imports: [],
  template: `
    <!-- Header -->
    <div style="margin-bottom:1.5rem">
      <h2 style="margin:0 0 .25rem;font-size:1.5rem;font-weight:700;color:#1f2937">Centro de ayuda</h2>
      <p style="margin:0;font-size:.875rem;color:#6b7280">Guías rápidas y soporte del portal.</p>
    </div>

    <!-- Tarjetas de guías -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;margin-bottom:1.5rem">

      <!-- Primeros pasos -->
      <div class="card" style="display:flex;flex-direction:column;gap:.75rem">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(239,246,255,1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          </svg>
        </div>
        <div>
          <h4 style="margin:0 0 .3rem;font-size:.95rem;font-weight:700;color:#1f2937">Primeros pasos</h4>
          <p style="margin:0;font-size:.82rem;color:#6b7280;line-height:1.5">Configura empresas, centros de costo y usuarios para empezar a operar.</p>
        </div>
      </div>

      <!-- Calendarizar actividades -->
      <div class="card" style="display:flex;flex-direction:column;gap:.75rem">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(237,233,254,1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div>
          <h4 style="margin:0 0 .3rem;font-size:.95rem;font-weight:700;color:#1f2937">Calendarizar actividades</h4>
          <p style="margin:0;font-size:.82rem;color:#6b7280;line-height:1.5">Aprende a programar tareas, asignar tipos y dar seguimiento en el calendario.</p>
        </div>
      </div>

      <!-- Documentos y respaldos -->
      <div class="card" style="display:flex;flex-direction:column;gap:.75rem">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(236,253,245,1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
          </svg>
        </div>
        <div>
          <h4 style="margin:0 0 .3rem;font-size:.95rem;font-weight:700;color:#1f2937">Documentos y respaldos</h4>
          <p style="margin:0;font-size:.82rem;color:#6b7280;line-height:1.5">Sube, organiza y controla el ciclo de vida de tus documentos.</p>
        </div>
      </div>

    </div>

    <!-- Banner de soporte -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1.5rem;padding:1.5rem 2rem;border-radius:14px;background:linear-gradient(135deg,#0095d6 0%,#0369a1 100%)">
      <div>
        <p style="margin:0 0 .25rem;font-size:1rem;font-weight:700;color:#fff">¿Necesitas soporte directo?</p>
        <p style="margin:0;font-size:.82rem;color:rgba(255,255,255,.85)">Nuestro equipo responde en menos de 24 horas hábiles.</p>
      </div>
      <a href="mailto:soporte@smartclarity.cl"
         style="display:flex;align-items:center;gap:.5rem;padding:.6rem 1.25rem;border-radius:9px;background:#fff;color:#0095d6;font-size:.85rem;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
        Contactar soporte
      </a>
    </div>
  `,
  styles: [`
    :host { display:block; }
  `],
})
export class AyudaPageComponent {}
