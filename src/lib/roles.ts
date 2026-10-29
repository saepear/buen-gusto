// Constantes y tipos compartidos del sistema El Buen Gusto

export const ROLES = {
  ADMIN: "ADMIN",
  MESERO: "MESERO",
  COCINA: "COCINA",
} as const;

export type Rol = keyof typeof ROLES;

export const ES_ROL_VALIDO = (v: string): v is Rol =>
  v === "ADMIN" || v === "MESERO" || v === "COCINA";

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
    case "COCINA":
      return "/cocina";
  }
}
