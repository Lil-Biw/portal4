import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProfileMode } from '../../profile/profile.types';
import { ConsumidorContextService } from '../../profile/consumidor-context.service';
import { ClientesService } from '../../features/clientes/clientes.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [NgFor, FormsModule],
  templateUrl: './topbar.component.html',
  styles: [`
    :host { display:block; }
    .topbar {
      height:60px;
      border-radius:14px;
      border:1px solid rgba(34,33,33,.1);
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:1rem;
      padding:0 1.25rem;
      box-shadow:0 2px 12px rgba(15,23,42,.06);
      background:#fff;
    }
    .topbar.admin      { border-left:4px solid #000000; }
    .topbar.consumidor { border-left:4px solid #0095d6; }

    .brand { display:flex; align-items:center; gap:.6rem; flex-shrink:0; }
    .brand-logo { height:36px; width:auto; display:block; border-radius:8px; }
    .brand-name { font-weight:800; font-size:1.05rem; color:#0095d6; letter-spacing:-.5px; }

    .context-slot { display:flex; align-items:center; gap:.6rem; flex:1; }
    .empresa-select {
      padding:.4rem .7rem;
      border-radius:8px;
      border:1px solid rgba(0,149,214,.35);
      font-size:.85rem;
      color:#374151;
      background:#fff;
      cursor:pointer;
      min-width:180px;
      max-width:260px;
    }
    .empresa-select:focus { outline:none; border-color:#0095d6; }

    .icons-slot { display:flex; align-items:center; gap:.5rem; }

    .actions { display:flex; align-items:center; gap:.75rem; flex-shrink:0; }
    .mode-chip {
      background:#0095d6;
      color:#fff;
      padding:.3rem .7rem;
      border-radius:999px;
      font-size:11px;
      font-weight:700;
      letter-spacing:.3px;
    }
    .topbar.consumidor .mode-chip { background:#0095d6; }
    .topbar.admin .mode-chip { background:#000000; }
    .toggle-btn {
      border:1px solid rgba(34,33,33,.18);
      background:transparent;
      color:#374151;
      border-radius:10px;
      padding:.45rem .85rem;
      font-weight:600;
      cursor:pointer;
      font-size:.85rem;
      transition:background .15s;
    }
    .toggle-btn:hover { background:rgba(34,33,33,.06); }
    .topbar.admin .toggle-btn { border-color:#000000; color:#000000; }
    .topbar.consumidor .toggle-btn { border-color:#0095d6; color:#0095d6; }
  `],
})
export class TopbarComponent implements OnInit {
  @Input() mode: ProfileMode = 'consumidor';
  @Output() modeToggle = new EventEmitter<void>();

  protected readonly clientesService = inject(ClientesService);
  private readonly consumidorContext = inject(ConsumidorContextService);
  private readonly router = inject(Router);

  protected localEmpresaId = '';

  get modeLabel() { return this.mode === 'admin' ? 'Administrador' : 'Consumidor'; }

  ngOnInit(): void {
    this.clientesService.cargar();
    this.localEmpresaId = this.consumidorContext.empresaSeleccionada()?._id ?? '';
  }

  onEmpresaChange(id: string): void {
    const empresa = this.clientesService.clientes().find(c => c._id === id) ?? null;
    this.consumidorContext.seleccionar(empresa);
  }

  irADocumentos(): void {
    this.router.navigate(['/documentos']);
  }
}
