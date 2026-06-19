import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CentroCosto, CreateCentroDto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';

// Parsea "38°45'32.8"S 72°36'34.3"W" → { lat, lng } en grados decimales.
// Acepta °, º, ', ′, ", ″ y espacios variables entre las dos coordenadas.
function parseDms(input: string): { lat: number; lng: number } | null {
  const part = /(\d+)[°º]\s*(\d+)[''′]\s*(\d+\.?\d*)["""″]\s*([NSns])\s+(\d+)[°º]\s*(\d+)[''′]\s*(\d+\.?\d*)["""″]\s*([EWew])/;
  const m = input.trim().match(part);
  if (!m) return null;
  const toDecimal = (d: string, min: string, sec: string, dir: string): number => {
    const val = +d + +min / 60 + +sec / 3600;
    return (dir.toUpperCase() === 'S' || dir.toUpperCase() === 'W') ? -val : val;
  };
  return {
    lat: toDecimal(m[1], m[2], m[3], m[4]),
    lng: toDecimal(m[5], m[6], m[7], m[8]),
  };
}

// Convierte grados decimales de vuelta a formato DMS para mostrar en el input.
function decimalToDms(lat: number, lng: number): string {
  const fmt = (val: number, posDir: string, negDir: string): string => {
    const abs = Math.abs(val);
    const d = Math.floor(abs);
    const mf = (abs - d) * 60;
    const min = Math.floor(mf);
    const sec = ((mf - min) * 60).toFixed(1);
    return `${d}°${min}'${sec}"${val >= 0 ? posDir : negDir}`;
  };
  return `${fmt(lat, 'N', 'S')} ${fmt(lng, 'E', 'W')}`;
}

@Component({
  selector: 'app-centro-form',
  standalone: true,
  imports: [FormsModule, NgFor, DecimalPipe],
  templateUrl: './centro-form.component.html',
})
export class CentroFormComponent implements OnChanges {
  private readonly sanitizer = inject(DomSanitizer);

  @Input() initial: CentroCosto | null = null;
  @Input() clientes: Cliente[] = [];
  @Input() submitLabel = 'Guardar';
  @Output() submitted = new EventEmitter<CreateCentroDto>();

  form: CreateCentroDto = this.empty();
  dmsInput = '';
  dmsError = '';
  previewMapUrl: SafeResourceUrl | null = null;
  tabUbicacion: 'direccion' | 'coordenadas' = 'direccion';

  setTabUbicacion(tab: 'direccion' | 'coordenadas'): void {
    if (this.tabUbicacion === tab) return;
    this.tabUbicacion = tab;
    if (tab === 'coordenadas') {
      this.form.ubicacion_direccion = '';
      this.form.ubicacion_ciudad = '';
      this.form.ubicacion_region = '';
      this.form.ubicacion_pais = '';
    } else {
      this.form.ubicacion_latitud = undefined;
      this.form.ubicacion_longitud = undefined;
      this.dmsInput = '';
      this.dmsError = '';
      this.previewMapUrl = null;
    }
  }

  get puedePrevisualizar(): boolean {
    return this.form.ubicacion_latitud != null && this.form.ubicacion_longitud != null;
  }

  onDmsChange(): void {
    if (!this.dmsInput.trim()) {
      this.form.ubicacion_latitud = undefined;
      this.form.ubicacion_longitud = undefined;
      this.dmsError = '';
      this.previewMapUrl = null;
      return;
    }
    const result = parseDms(this.dmsInput);
    if (result) {
      this.form.ubicacion_latitud = result.lat;
      this.form.ubicacion_longitud = result.lng;
      this.dmsError = '';
    } else {
      this.form.ubicacion_latitud = undefined;
      this.form.ubicacion_longitud = undefined;
      this.dmsError = 'Formato inválido. Ejemplo: 38°45\'32.8"S 72°36\'34.3"W';
    }
    this.previewMapUrl = null;
  }

  verEnMapa(): void {
    const lat = this.form.ubicacion_latitud;
    const lng = this.form.ubicacion_longitud;
    if (lat == null || lng == null) return;
    this.previewMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://maps.google.com/maps?q=${lat},${lng}&output=embed&z=14`
    );
  }

  ngOnChanges(): void {
    this.previewMapUrl = null;
    this.dmsError = '';
    const lat = this.initial?.ubicacion_latitud;
    const lng = this.initial?.ubicacion_longitud;
    this.dmsInput = (lat != null && lng != null) ? decimalToDms(lat, lng) : '';
    this.tabUbicacion = (lat != null && lng != null) ? 'coordenadas' : 'direccion';
    this.form = this.initial
      ? {
          cliente_id: this.initial.cliente_id,
          codigo: this.initial.codigo,
          nombre: this.initial.nombre,
          descripcion: this.initial.descripcion ?? '',
          ubicacion_direccion: this.initial.ubicacion_direccion ?? '',
          ubicacion_ciudad: this.initial.ubicacion_ciudad ?? '',
          ubicacion_region: this.initial.ubicacion_region ?? '',
          ubicacion_pais: this.initial.ubicacion_pais ?? 'Chile',
          ubicacion_latitud: lat,
          ubicacion_longitud: lng,
        }
      : this.empty();
  }

  submit(): void { this.submitted.emit(this.form); }

  private empty(): CreateCentroDto {
    return { cliente_id: '', codigo: '', nombre: '', descripcion: '', ubicacion_direccion: '', ubicacion_ciudad: '', ubicacion_region: '', ubicacion_pais: 'Chile', ubicacion_latitud: undefined, ubicacion_longitud: undefined };
  }
}
