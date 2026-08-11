# Imagen de portada para empresas

**Fecha:** 2026-08-11
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El formulario de empresa (`ClienteFormComponent`) solo permite subir un `logo`
(isotipo de marca). El formulario de centro (`CentroFormComponent`) ya tiene,
desde el plan `2026-08-10-foto-identificacion-empresas-centros`, un segundo
campo de imagen (`foto`, la fotografía real del lugar) además de su propio
`logo`... salvo que `CentroCosto` **no tiene logo** — solo tiene `foto`. La
asimetría real es esta:

| Entidad  | Campo(s) de imagen hoy       |
|----------|-------------------------------|
| Cliente (empresa) | `logo` únicamente |
| CentroCosto (centro) | `foto` únicamente |

El usuario pidió agregar al formulario de empresa una imagen adicional al
logo — una imagen genérica de portada/banner, no una "foto real del lugar"
(la empresa no tiene una sede física única en el modelo de datos). Este
documento diseña ese campo nuevo (`imagen`) y, de paso, corrige un
mislabeling existente en "Mi ficha" (ver sección Mi ficha).

Adicionalmente, como la lógica de subida de imagen (preview, placeholder,
input file) ya estaba duplicada entre `cliente-form` (versión simple) y
`centro-form` (versión con panel lateral), y esta feature sería la tercera
copia, se aprovecha para extraer un componente compartido y migrar los tres
usos (`logo`, `foto` de centro, `imagen` de empresa) a él.

## Alcance

**Incluye:**
- Campo `imagen` en `Cliente` (backend) con endpoints de subida/servido.
- Componente compartido `image-upload` (frontend).
- Formulario de empresa con dos paneles: Logo + Imagen de portada.
- Migración de `centro-form` al componente compartido (sin cambio de
  comportamiento).
- Corrección del mislabeling en "Mi ficha": el recuadro grande pasa a
  mostrar `imagen`; el `logo` se muestra como insignia pequeña junto al
  nombre de la empresa.

**Fuera de alcance:**
- Thumbnail de `imagen` o `logo` en el listado admin de empresas
  (`clientes-list`) — no fue pedido.
- Migración de datos existentes — el campo es opcional, empresas sin
  `imagen` simplemente no la tienen (mismo comportamiento que `logo` cuando
  se introdujo).
- Cualquier cambio al campo `foto` de centro más allá de migrarlo al nuevo
  componente compartido (sin alterar su semántica ni sus endpoints).

## Backend (back4)

### Schema

`back4/src/clientes/clientes.schema.ts` — nuevo campo, mismo shape que
`logo`:

```ts
@Prop({
  type: {
    contenido: Buffer,
    tipo_mime: String,
    nombre: String,
  },
})
imagen?: { contenido: Buffer; tipo_mime: string; nombre: string };
```

Igual que `logo`, se guarda como `Buffer` en Mongo (excepción documentada en
`back4/CLAUDE.md`), no pasa por S3.

### Service (`clientes.service.ts`)

- `subirImagen(id, archivo)` — copia exacta de `subirLogo`, actualiza el
  campo `imagen` vía `findByIdAndUpdate` con `runValidators: false`.
- `servirImagen(id)` — copia exacta de `servirLogo`, mismo manejo defensivo
  de `Buffer` vs `Binary` de Mongo (`cliente.imagen.contenido`).
- Todos los `.select('-logo.contenido')` existentes (`findAll`, `findOne`,
  `update`, `updateScoreSmartclarity`, `updateConfigGrafico`) se amplían a
  `.select('-logo.contenido -imagen.contenido')` para no filtrar el binario
  en las respuestas de lectura normales.

### Controller (`clientes.controller.ts`)

```ts
@Post(':id/imagen')
@Roles('super_admin', 'admin_smartclarity')
@UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
subirImagen(@Param('id') id: string, @UploadedFile() archivo: ...) {
  if (!archivo) throw new BadRequestException('No se proporcionó archivo');
  return this.clientesService.subirImagen(id, archivo);
}

@Get(':id/imagen')
@Public()
async servirImagen(@Param('id') id: string, @Res() res: Response) {
  const { buffer, tipo_mime, nombre } = await this.clientesService.servirImagen(id);
  sendFile(res, buffer, tipo_mime, nombre, true);
}
```

Mismos roles y visibilidad que `logo` — no requiere `EmpresaAccessGuard`
porque `ClientesController` no lo usa a nivel de clase (a diferencia de
centros).

No hay cambios de DTO: igual que `logo`, `imagen` no viaja en el body JSON
del CRUD (`CreateClienteDto`/`UpdateClienteDto`), solo por el endpoint
multipart dedicado.

## Frontend (front4)

### Componente compartido `shared/components/image-upload/`

```ts
@Component({
  selector: 'app-image-upload',
  standalone: true,
  templateUrl: './image-upload.component.html',
})
export class ImageUploadComponent implements OnChanges {
  @Input() titulo = 'Imagen';
  @Input() aspectRatio = '4/3';       // '1/1' para logo, '4/3' para foto/imagen
  @Input() hint = 'JPG o PNG';
  @Input() initialUrl: string | null = null;
  @Output() archivoSeleccionado = new EventEmitter<File | null>();

  preview: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialUrl']) this.preview = this.initialUrl;
  }

  onFileChange(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.archivoSeleccionado.emit(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => { this.preview = e.target?.result as string; this.cdr.markForCheck(); };
      reader.readAsDataURL(file);
    } else {
      this.preview = this.initialUrl;
    }
  }
}
```

Template: el panel lateral que hoy vive inline en `centro-form.component.html`
(líneas 100-115) — caja con `aspectRatio` configurable, placeholder de
cámara cuando no hay preview, botón "Cambiar {{ titulo | lowercase }}" y
`hint` debajo. Parametrizado con `titulo`/`aspectRatio`/`hint` en vez de los
literales "Foto del centro" hardcodeados.

**Contrato con el padre:** el componente solo gestiona preview + emite el
`File` crudo. El padre (`cliente-form`, `centro-form`) sigue siendo dueño de
guardar ese `File` en una variable local (`_logoFile`, `_imagenFile`,
`_fotoFile`) y de emitirlo en su propio `submit()` — mismo contrato externo
que existe hoy (`@Output() logoFile`, `@Output() fotoFile`), así que
`ClientesPageComponent`/`CentrosPageComponent` no cambian su forma de
consumir el form.

### `centro-form` — migración sin cambio de comportamiento

Reemplaza el bloque inline (líneas 100-115 de
`centro-form.component.html`) por:

```html
<app-image-upload
  titulo="Foto del centro"
  aspectRatio="4/3"
  hint="JPG o PNG · se muestra en el listado y en el detalle del centro"
  [initialUrl]="resolveFotoUrl(initial)"
  (archivoSeleccionado)="_fotoFile = $event">
</app-image-upload>
```

`centro-form.component.ts` pierde `fotoPreview` y `onFotoSelected()` (ya no
los necesita — el hijo los reemplaza), conserva `resolveFotoUrl()` y
`_fotoFile`.

### `cliente-form` — dos paneles

Layout pasa de una sola columna (`form-grid`) a `1fr 230px` como
`centro-form`, con dos `<app-image-upload>` apilados en la columna lateral:

```html
<app-image-upload
  titulo="Logo"
  aspectRatio="1/1"
  hint="Opcional. JPG, PNG o SVG."
  [initialUrl]="resolveLogoUrl(initial)"
  (archivoSeleccionado)="_logoFile = $event">
</app-image-upload>

<app-image-upload
  titulo="Imagen de portada"
  aspectRatio="4/3"
  hint="JPG o PNG · se muestra en Mi ficha"
  [initialUrl]="resolveImagenUrl(initial)"
  (archivoSeleccionado)="_imagenFile = $event">
</app-image-upload>
```

`ClienteFormComponent` gana `@Output() imagenFile`, `_imagenFile`,
`resolveImagenUrl()` (mismo patrón que `resolveLogoUrl`, apuntando a
`GET /empresas/:id/imagen`), y emite ambos archivos en `submit()`.

### Modelo (`cliente.model.ts`)

```ts
export interface Cliente {
  ...
  logo?: { tipo_mime: string; nombre: string };
  imagen?: { tipo_mime: string; nombre: string };
  ...
}
```

### `ClientesService` (front)

- `subirImagen(id, file, onSuccess?, onError?)` — copia de `subirLogo`,
  apunta a `POST /empresas/:id/imagen`.
- `crear(dto, logoFile?, imagenFile?)` / `actualizar(id, dto, logoFile?,
  imagenFile?)`: tras crear/actualizar la entidad, suben logo e imagen
  **secuencialmente** (si ambos vienen) — primero logo, luego imagen — y
  acumulan los mensajes de error de cada subida fallida en un solo mensaje
  de status (`Empresa creada, pero no se pudo subir: logo (…), imagen
  (…)`), sin bloquear la creación de la empresa si alguna subida falla.
  Mismo espíritu que el manejo de error actual de `subirLogo` — falla suave,
  no revierte la entidad ya creada/actualizada.

### `ClientesPageComponent`

- Nueva señal `pendingImagen = signal<File | null>(null)`, con el mismo
  ciclo de vida que `pendingLogo`: reset en `abrirCrear`, `abrirEditar`,
  `cerrar`, `editarDesdeBuscar`; se lee en `crear()`/`actualizar()` y se
  pasa como segundo/tercer argumento a `service.crear()`/`actualizar()`.
- `clientes-page.component.html`: el `<app-cliente-form>` agrega
  `(imagenFile)="pendingImagen.set($event)"` junto al `(logoFile)` existente.

### Mi ficha (`mi-ficha-page.component.ts`/`.html`)

Corrige el mislabeling actual: el computed `fotoUrl` (que hoy en realidad
resuelve `GET /empresas/:id/logo` pese a mostrarse como "Foto de la
empresa") se **renombra a `imagenUrl`** y pasa a resolver
`GET /empresas/:id/imagen`:

```ts
protected imagenUrl = computed(() => {
  const emp = this.empresa();
  if (!emp?._id || !emp?.imagen?.tipo_mime) return null;
  return this.api.url(`/empresas/${emp._id}/imagen`);
});

protected logoUrl = computed(() => {
  const emp = this.empresa();
  if (!emp?._id || !emp?.logo?.tipo_mime) return null;
  return this.api.url(`/empresas/${emp._id}/logo`);
});
```

En el template:
- El recuadro grande (200px, línea 64 de `mi-ficha-page.component.html`)
  pasa a usar `imagenUrl()` en vez de `fotoUrl()` — mismo placeholder
  "Sin foto" si no hay imagen cargada.
- En el header de la página (junto a la razón social, líneas 1-7), se
  agrega una insignia pequeña (32px, `border-radius:8px`) con `logoUrl()`,
  oculta completamente (`@if`) si la empresa no tiene logo — no se muestra
  placeholder ahí para no ensuciar el header cuando no hay logo.

## Manejo de errores

- Backend: mismos códigos que `logo` — `BadRequestException` si no se
  adjunta archivo, `NotFoundException` si la empresa no existe o no tiene
  imagen al servirla, `OPCIONES_SUBIDA` limita a 20MB (constante
  compartida, sin cambios).
- Frontend: `ClientesService` sigue el patrón `setError`/`setStatus`
  existente — errores de subida de imagen no bloquean la operación
  principal (crear/actualizar), se reportan como advertencia en el status
  banner del modal.

## Testing

- Verificación manual en navegador (dev server) del flujo completo: crear
  empresa con logo + imagen, editar reemplazando solo uno de los dos,
  visualizar en "Mi ficha" (recuadro grande = imagen, insignia = logo),
  confirmar que `centro-form` sigue funcionando igual tras la migración al
  componente compartido.
- No hay suite de tests automatizados de frontend para este flujo hoy
  (`ClienteFormComponent`/`CentroFormComponent` no tienen specs) — no se
  agregan en este trabajo, consistente con el resto del módulo.
