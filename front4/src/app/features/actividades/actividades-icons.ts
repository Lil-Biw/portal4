export interface ColorActividad {
  valor: string;
  label: string;
  icono: string;
}

export const COLORES_ACTIVIDAD: ColorActividad[] = [
  { valor: '#4E9AC7', label: 'Azul',    icono: 'calendario'  },
  { valor: '#5FAE7B', label: 'Verde',   icono: 'check'       },
  { valor: '#D9A24B', label: 'Ámbar',   icono: 'llave'       },
  { valor: '#D46A63', label: 'Rojo',    icono: 'alerta'      },
  { valor: '#9B85C9', label: 'Morado',  icono: 'reunion'     },
  { valor: '#7B82C9', label: 'Índigo',  icono: 'documento'   },
];

export function clavePorColorActividad(color: string): string {
  const match = COLORES_ACTIVIDAD.find(
    c => c.valor.toLowerCase() === color.toLowerCase()
  );
  return match?.icono ?? 'calendario';
}
