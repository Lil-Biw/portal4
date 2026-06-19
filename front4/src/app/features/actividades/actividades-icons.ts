export interface ColorActividad {
  valor: string;
  label: string;
  icono: string;
}

export const COLORES_ACTIVIDAD: ColorActividad[] = [
  { valor: '#0095d6', label: 'Azul',    icono: 'calendario'  },
  { valor: '#22c55e', label: 'Verde',   icono: 'check'       },
  { valor: '#f59e0b', label: 'Ámbar',   icono: 'llave'       },
  { valor: '#ef4444', label: 'Rojo',    icono: 'alerta'      },
  { valor: '#8b5cf6', label: 'Morado',  icono: 'reunion'     },
  { valor: '#6366f1', label: 'Índigo',  icono: 'documento'   },
];

export function clavePorColorActividad(color: string): string {
  const match = COLORES_ACTIVIDAD.find(
    c => c.valor.toLowerCase() === color.toLowerCase()
  );
  return match?.icono ?? 'calendario';
}
