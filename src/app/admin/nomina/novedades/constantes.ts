// Constantes de novedades de nómina (compartidas client/server)
export const TIPO_NOVEDAD = {
  COMISION: "COMISION",
  BONIFICACION: "BONIFICACION",
  AUSENCIA: "AUSENCIA",
  INCAPACIDAD: "INCAPACIDAD",
  PERMISO_REMUNERADO: "PERMISO_REMUNERADO",
  PERMISO_NO_REMUNERADO: "PERMISO_NO_REMUNERADO",
  VACACIONES: "VACACIONES",
  DESCUENTO: "DESCUENTO",
} as const;

export const TIPO_NOVEDAD_LABEL: Record<string, string> = {
  COMISION: "Comisión",
  BONIFICACION: "Bonificación",
  AUSENCIA: "Ausencia",
  INCAPACIDAD: "Incapacidad",
  PERMISO_REMUNERADO: "Permiso remunerado",
  PERMISO_NO_REMUNERADO: "Permiso sin remuneración",
  VACACIONES: "Vacaciones",
  DESCUENTO: "Descuento autorizado",
};

export const ESTADO_NOVEDAD = {
  PENDIENTE: "PENDIENTE",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
} as const;
