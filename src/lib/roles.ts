// Constantes y tipos compartidos del sistema El Buen Gusto

export const ROLES = {
  ADMIN: "ADMIN",
  MESERO: "MESERO",
  DOMICILIARIO: "DOMICILIARIO",
} as const;

export type Rol = keyof typeof ROLES;

export const ES_ROL_VALIDO = (v: string): v is Rol =>
  v === "ADMIN" || v === "MESERO" || v === "DOMICILIARIO";

export const TIPO_PRODUCTO = {
  PROTEINA: "PROTEINA",
  PRINCIPIO: "PRINCIPIO",
  ENSALADA: "ENSALADA",
  SOPA: "SOPA",
  BEBIDA: "BEBIDA",
  ADICIONAL: "ADICIONAL",
} as const;

export type TipoProducto = keyof typeof TIPO_PRODUCTO;

export const TIPO_PRODUCTO_LABEL: Record<TipoProducto, string> = {
  PROTEINA: "Proteína",
  PRINCIPIO: "Principio",
  ENSALADA: "Ensalada",
  SOPA: "Sopa",
  BEBIDA: "Bebida",
  ADICIONAL: "Adicional",
};

export const ES_TIPO_VALIDO = (v: string): v is TipoProducto =>
  v === "PROTEINA" || v === "PRINCIPIO" || v === "ENSALADA" || v === "SOPA" ||
  v === "BEBIDA" || v === "ADICIONAL";
export const TIPOS_MENU_DIA: TipoProducto[] = ["PROTEINA", "PRINCIPIO", "ENSALADA", "SOPA"];

/**
 * Orden de impresión en la comanda y en el recibo: como arman la bandeja
 * (principio abajo → proteinas encima → adicionales como el huevo → sopa
 * aparte). Empates dentro del grupo quedan en el orden en que se pidieron.
 */
export const ORDEN_IMPRIMIR: Record<TipoProducto, number> = {
  PRINCIPIO: 1,
  ENSALADA: 2,
  PROTEINA: 3,
  ADICIONAL: 4,
  SOPA: 5,
  BEBIDA: 6,
};

export function ordenDeItem(tipo: string): number {
  return (ORDEN_IMPRIMIR as Record<string, number | undefined>)[tipo] ?? 99;
}

export const ESTADO_MESA = {
  LIBRE: "LIBRE",
  OCUPADA: "OCUPADA",
  POR_PAGAR: "POR_PAGAR",
} as const;

export type EstadoMesa = keyof typeof ESTADO_MESA;

export const ESTADO_PEDIDO = {
  ENVIADO: "ENVIADO",
  EN_PREPARACION: "EN_PREPARACION",
  PARCIAL_SERVIDO: "PARCIAL_SERVIDO",
  SERVIDO: "SERVIDO",
  POR_PAGAR: "POR_PAGAR",
  COBRADO: "COBRADO",
  CANCELADO: "CANCELADO",
} as const;

export type EstadoPedido = keyof typeof ESTADO_PEDIDO;

/** Etiquetas legibles de los estados de la comanda */
export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
  ENVIADO: "Enviada a cocina",
  EN_PREPARACION: "En preparación",
  PARCIAL_SERVIDO: "Parcialmente servida",
  SERVIDO: "Lista para servir",
  POR_PAGAR: "Por pagar",
  COBRADO: "Pagada",
  CANCELADO: "Cancelada",
};

export const ESTADO_DOMICILIO = {
  PENDIENTE: "PENDIENTE",
  ASIGNADO: "ASIGNADO",
  EN_CAMINO: "EN_CAMINO",
  ENTREGADO: "ENTREGADO",
  NO_ENTREGADO: "NO_ENTREGADO",
  CANCELADO: "CANCELADO",
} as const;

export type EstadoDomicilio = keyof typeof ESTADO_DOMICILIO;

/** Etiquetas legibles de los estados del domicilio */
export const ESTADO_DOMICILIO_LABEL: Record<EstadoDomicilio, string> = {
  PENDIENTE: "Pendiente de asignar",
  ASIGNADO: "Asignado",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  NO_ENTREGADO: "No entregado",
  CANCELADO: "Cancelado",
};

/** Estados en los que el domicilio sigue vivo (no cerrado) */
export const ESTADOS_ACTIVOS_DOMICILIO: EstadoDomicilio[] = [
  ESTADO_DOMICILIO.PENDIENTE,
  ESTADO_DOMICILIO.ASIGNADO,
  ESTADO_DOMICILIO.EN_CAMINO,
];

/** Métodos de pago aceptados en caja */
export const METODOS_PAGO = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const;

export type MetodoPago = (typeof METODOS_PAGO)[number];

export const ES_METODO_PAGO = (v: string): v is MetodoPago =>
  v === "EFECTIVO" || v === "TARJETA" || v === "TRANSFERENCIA";

/** Página de inicio según el rol del usuario */
export function destinoRol(rol: Rol): string {
  switch (rol) {
    case "ADMIN":
      return "/admin";
    case "MESERO":
      return "/mesero";
    case "DOMICILIARIO":
      return "/domicilios";
  }
}
