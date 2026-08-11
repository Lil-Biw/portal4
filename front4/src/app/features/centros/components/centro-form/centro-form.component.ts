import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CentroCosto, CreateCentroDto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { ApiService } from '../../../../core/services/api.service';
import { asId } from '../../../../shared/utils';

// Parsea "lat, lng" en formato decimal de Google Maps, ej: -38.758556, -72.609528
function parseDecimal(input: string): { lat: number; lng: number } | null {
  const m = input.trim().match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

@Component({
  selector: 'app-centro-form',
  standalone: true,
  imports: [FormsModule, NgFor],
  templateUrl: './centro-form.component.html',
})
export class CentroFormComponent implements OnChanges {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() initial: CentroCosto | null = null;
  @Input() clientes: Cliente[] = [];
  @Input() submitLabel = 'Guardar';
  @Output() submitted = new EventEmitter<CreateCentroDto>();
  @Output() fotoFile = new EventEmitter<File | null>();

  form: CreateCentroDto = this.empty();
  coordInput = '';
  coordError = '';
  previewMapUrl: SafeResourceUrl | null = null;
  tabUbicacion: 'direccion' | 'coordenadas' = 'direccion';
  fotoPreview: string | null = null;
  private _fotoFile: File | null = null;

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
      this.coordInput = '';
      this.coordError = '';
      this.previewMapUrl = null;
    }
  }

  get puedePrevisualizar(): boolean {
    return this.form.ubicacion_latitud != null && this.form.ubicacion_longitud != null;
  }

  onCoordChange(): void {
    if (!this.coordInput.trim()) {
      this.form.ubicacion_latitud = undefined;
      this.form.ubicacion_longitud = undefined;
      this.coordError = '';
      this.previewMapUrl = null;
      return;
    }
    const result = parseDecimal(this.coordInput);
    if (result) {
      this.form.ubicacion_latitud = result.lat;
      this.form.ubicacion_longitud = result.lng;
      this.coordError = '';
    } else {
      this.form.ubicacion_latitud = undefined;
      this.form.ubicacion_longitud = undefined;
      this.coordError = 'Formato inválido. Pega las coordenadas de Google Maps, ej: -38.758556, -72.609528';
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

  // El backend no devuelve el binario de la foto (solo tipo_mime/nombre, ver
  // centros-costos.service.ts findOne/findAllByCliente con .select('-foto.contenido'))
  // — hay que pedirla al endpoint dedicado GET /empresas/:empresaId/centros/:centroId/foto.
  private resolveFotoUrl(centro: CentroCosto | null): string | null {
    if (!centro?._id || !centro?.foto?.tipo_mime) return null;
    return this.api.url(`/empresas/${asId(centro.cliente_id)}/centros/${asId(centro._id)}/foto`);
  }

  onFotoSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this._fotoFile = file;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { this.fotoPreview = e.target?.result as string; this.cdr.markForCheck(); };
      reader.readAsDataURL(file);
    } else {
      this.fotoPreview = this.resolveFotoUrl(this.initial);
    }
  }

  ngOnChanges(): void {
    this.previewMapUrl = null;
    this.coordError = '';
    const lat = this.initial?.ubicacion_latitud;
    const lng = this.initial?.ubicacion_longitud;
    this.coordInput = (lat != null && lng != null) ? `${lat}, ${lng}` : '';
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
    this.fotoPreview = this.resolveFotoUrl(this.initial);
    this._fotoFile = null;
  }

  submit(): void {
    this.fotoFile.emit(this._fotoFile);
    this.submitted.emit(this.form);
  }

  private empty(): CreateCentroDto {
    return { cliente_id: '', codigo: '', nombre: '', descripcion: '', ubicacion_direccion: '', ubicacion_ciudad: '', ubicacion_region: '', ubicacion_pais: 'Chile', ubicacion_latitud: undefined, ubicacion_longitud: undefined };
  }
}
