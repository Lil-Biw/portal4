# Tag "creado por" en actividades (admin y consumidor)

## Contexto

En la pestaña de Actividades (asociadas a empresa/centro), cuando se crea una
actividad no queda registro de qué usuario interno la creó. Ante consultas o
reclamos sobre una actividad, no hay forma de identificar ni contactar (por
correo o en persona) a quien la generó.

El schema `Actividad` (`back4/src/actividades/actividades.schema.ts`) hoy solo
tiene `creado_en`/`actualizado_en` (timestamps automáticos), sin ningún campo
de autoría. El endpoint de creación (`ActividadesController.create`) ya está
restringido a `@Roles('super_admin', 'admin_smartclarity')`, así que el
creador de una actividad siempre es un usuario interno de Eclarity, nunca un
"usuario" consumidor.

Existe un precedente parcialmente implementado en `proyectos`: el schema tiene
`creado_por?: Types.ObjectId` (ref `Usuario`) y el service ya sabe setearlo,
pero el controller nunca extrae `req.user.sub` ni lo pasa — es dead code hoy.
Esta spec no toca `proyectos`; solo usa ese patrón como referencia para
`actividades`.

También existe un precedente de un feature similar ya implementado —
"tag subido por" en documentos ([[2026-07-17-tag-subido-por-documentos-design]])
— pero ese caso **resuelve el nombre en tiempo de lectura** (solo guarda el
`ObjectId` y hace `populate`/lookup en cada `GET`). Aquí se eligió lo opuesto
a propósito (ver decisión de snapshot abajo): guardar nombre y correo como
foto fija en el momento de creación, porque el objetivo explícito es poder
identificar y contactar al creador aunque su cuenta cambie o se desactive
después.

## Alcance

- Solo aplica a la creación de actividades. No se registra quién modificó una
  actividad después de creada (decisión explícita del usuario: solo importa
  el creador original).
- El tag se muestra tanto en la vista admin (`actividades-page.component`)
  como en la vista consumidor (`mis-actividades-page.component`) — el cliente
  final también debe poder ver quién de Eclarity creó la actividad.
- No se agrega búsqueda/filtro por creador. El dato se consulta caso a caso
  al abrir el detalle de una actividad ya seleccionada.
- No hay backfill de actividades existentes: nacen sin el tag y simplemente
  no lo muestran (no es un bug).

## Diseño de datos (backend)

### Decisión: snapshot fijo, no referencia viva

Se guardan tres campos en `Actividad`, todos opcionales:

```ts
@Prop({ type: Types.ObjectId, ref: 'Usuario' }) creado_por?: Types.ObjectId;
@Prop() creado_por_nombre?: string;
@Prop() creado_por_email?: string;
```

- `creado_por`: referencia al usuario, por si en el futuro se necesita
  enlazar a su perfil o hacer analítica. No se usa para mostrar nada hoy.
- `creado_por_nombre` / `creado_por_email`: copia fija de esos datos en el
  momento exacto de creación. Si el usuario después cambia su nombre o
  correo, o es desactivado/eliminado, el tag de la actividad sigue mostrando
  con quién se creó realmente — es un registro de auditoría, no un lookup en
  vivo.

### Captura del dato — `ActividadesController.create`

Agregar `@Req() req` al endpoint de creación
(`back4/src/actividades/actividades.controller.ts`) y extraer el id del
usuario autenticado desde el JWT ya presente en `req.user.sub`:

```ts
@Post()
@Roles('super_admin', 'admin_smartclarity')
create(
  @Param('centroId') centroId: string,
  @Body() dto: CreateActividadDto,
  @Req() req: Request,
) {
  const creadoPorId = (req as any)?.user?.sub as string | undefined;
  return this.service.create({ ...dto, centro_costo_id: centroId }, creadoPorId);
}
```

### Resolución y guardado — `ActividadesService.create`

```ts
async create(dto: CreateActividadDto, creadoPorId?: string): Promise<any> {
  const { notificacion, documentos_nombres, ...actividadData } = dto;

  let autoria: Partial<Actividad> = {};
  if (creadoPorId) {
    const usuario = await this.usuarioModel
      .findById(creadoPorId)
      .select('nombre email')
      .lean();
    if (usuario) {
      autoria = {
        creado_por: new Types.ObjectId(creadoPorId),
        creado_por_nombre: usuario.nombre,
        creado_por_email: usuario.email,
      };
    }
  }

  const a = await new this.actividadModel({ ...actividadData, ...autoria }).save();
  // ...resto del método sin cambios
}
```

Se busca en la base de datos (no se confía en el JWT para nombre, que ni
siquiera lo trae) para asegurar el dato correcto en ese instante.
`ActividadesService` ya tiene `usuarioModel` inyectado en su constructor
(`@InjectModel('Usuario') private usuarioModel: Model<...>`), así que no
requiere wiring nuevo.

Si `creadoPorId` no viene o el usuario no existe, la actividad se crea igual,
sin los campos de autoría — no debe fallar la creación por esto.

Como estos campos no vienen del body (`CreateActividadDto` no los incluye ni
debe incluirlos), no hay riesgo de que alguien falsifique el creador desde el
frontend.

## Frontend

### Modelo

`front4/src/app/shared/models/actividad.model.ts` — agregar:

```ts
creado_por_nombre?: string;
creado_por_email?: string;
```

El backend ya los devuelve en cualquier `GET` de actividad porque están
guardados directamente en el documento (no requiere `populate` ni lookup
adicional).

### Dónde se muestra

En ambos componentes — `actividades-page.component` (admin) y
`mis-actividades-page.component` (consumidor) — en los dos lugares donde se
ve el detalle de una actividad ya seleccionada:

1. Panel de detalle vista Día (bloque `cal-day-detail-fields`).
2. Modal/resumen al hacer clic en un evento en vista Mes/Semana (bloque
   `actividad-detalle-grid`).

Se agrega una fila más junto a Fecha/Empresa/Centro/Descripción:

```html
@if (actividad.creado_por_nombre) {
  <div class="detalle-fila">
    <span class="detalle-label">Creado por</span>
    <span class="detalle-valor">{{ actividad.creado_por_nombre }} ({{ actividad.creado_por_email }})</span>
  </div>
}
```

(la clase/markup exacto se ajusta al patrón visual ya usado por las demás
filas de ese mismo bloque en cada componente).

- Si la actividad no tiene `creado_por_nombre` (creada antes de este cambio),
  la fila no se renderiza — sin placeholder tipo "Desconocido".
- El paso "Resumen" del wizard de creación no se toca: en ese momento el
  usuario que está creando ya sabe que es él mismo.

## Casos borde

- **Actividad antigua sin creador**: los 3 campos son opcionales y no se
  migran retroactivamente; el tag simplemente no aparece.
- **Usuario eliminado después de crear la actividad**: `creado_por_nombre` y
  `creado_por_email` siguen mostrándose igual (son snapshot). `creado_por`
  (la referencia) queda huérfana, pero no se usa para render, así que no
  rompe la UI.
- **`creadoPorId` inválido o usuario no encontrado**: la actividad se crea
  igual, sin campos de autoría (no debe bloquear la creación).

## Testing

- Backend: test unitario de `ActividadesService.create` — casos: con
  `creadoPorId` válido (guarda los 3 campos), sin `creadoPorId` (crea igual,
  sin esos campos), con `creadoPorId` que no matchea ningún usuario (crea
  igual, sin esos campos, no revienta).
- Manual: crear una actividad logueado como admin, abrir su detalle en vista
  Día y en el modal de Mes/Semana, confirmar que aparece "Creado por: nombre
  (correo)"; repetir logueado como usuario consumidor viendo la misma
  actividad en "Mis actividades" y confirmar que también se ve; abrir una
  actividad creada antes del cambio y confirmar que no rompe el panel ni
  muestra una fila vacía.

## Fuera de alcance

- Registrar quién modificó (editó) una actividad después de creada.
- Búsqueda/filtro de actividades por nombre o correo del creador.
- Backfill de `creado_por*` para actividades ya existentes.
- Resolver el nombre en tiempo de lectura vía `populate` (opción descartada;
  se eligió snapshot fijo — ver "Decisión: snapshot fijo, no referencia
  viva").
