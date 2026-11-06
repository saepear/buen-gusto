// Constantes y tipos compartidos del sistema El Buen Gusto

export const ROLES = {
  ADMIN: "ADMIN",
  MESERO: "MESERO",
} as const;

export type Rol = keyof typeof ROLES;

export const ES_ROL_VALIDO = (v: string): v is Rol =>
  v === "ADMIN" || v === "MESERO";

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
 * Orden de lectura de la comanda: primero el principio, encima la proteína,
 * luego la ensalada (si la hay) y de última la sopa (si la hay); tras la sopa
 * vienen las categorías propias (5, orden por defecto para tipos no fijos) y
 * después siguen los adicionales y las bebidas. Empates dentro del grupo
 * quedan en el orden en que se pidieron.
 */
export const ORDEN_IMPRIMIR: Record<TipoProducto, number> = {
  PRINCIPIO: 1,
  PROTEINA: 2,
  ENSALADA: 3,
  SOPA: 4,
  ADICIONAL: 6,
  BEBIDA: 7,
};

export function ordenDeItem(tipo: string): number {
  // 5: las categorías propias del cliente entran al almuerzo y se leen
  // justo después de la sopa, antes que bebidas y adicionales
  return (ORDEN_IMPRIMIR as Record<string, number | undefined>)[tipo] ?? 5;
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
  // La comanda se convirtió en deuda (CuentaPorCobrar): NO hay dinero aún.
  // Sale de todas las colas (cocina, caja, mesas) pero sigue en la BD y su
  // recaudo entra el día del abono, no el día del fiado.
  FIADO: "FIADO",
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
  FIADO: "Fiada (deuda por cobrar)",
  CANCELADO: "Cancelada",
};

export const ESTADO_DOMICILIO = {
  // Registrado y esperando su cobro (estados vivos del tablero)
  PENDIENTE: "PENDIENTE",
  // Histórico: la comida ya salió/entregó y faltaba el dinero. Ya no se
  // escribe en el flujo nuevo (el cobro es el único paso siguiente), pero
  // los registros viejos de la BD siguen mostrándose con él.
  ENTREGADO: "ENTREGADO",
  // La comanda se fió: nació CuentaPorCobrar. Sale del tablero (su recaudo
  // entra con los abonos en «Cuentas por cobrar»), queda en el historial.
  FIADO: "FIADO",
  CANCELADO: "CANCELADO",
} as const;
// Los estados ASIGNADO / EN_CAMINO / NO_ENTREGADO del seguimiento de
// domiciliarios se retiraron con ese rol; no quedan filas con ellos en la BD.

export type EstadoDomicilio = keyof typeof ESTADO_DOMICILIO;

/** Etiquetas legibles de los estados del domicilio */
export const ESTADO_DOMICILIO_LABEL: Record<EstadoDomicilio, string> = {
  PENDIENTE: "Pendiente de cobro",
  ENTREGADO: "Entregado",
  FIADO: "Fiada (deuda por cobrar)",
  CANCELADO: "Cancelado",
};

/** Estados en los que el domicilio sigue sin dinero: falta el cobro */
export const ESTADOS_ACTIVOS_DOMICILIO: EstadoDomicilio[] = [
  ESTADO_DOMICILIO.PENDIENTE,
  ESTADO_DOMICILIO.ENTREGADO,
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
    // Roles retirados (p. ej. la sesión vieja de un DOMICILIARIO): al login.
    default:
      return "/login";
  }
}

// ════════ Módulos administrativos: apartados, cuentas por cobrar y gastos ════════
// (SQLite no soporta enums: String validadas contra estas constantes)

export const ESTADO_APARTADO = {
  PENDIENTE: "PENDIENTE",
  ENTREGADO: "ENTREGADO",
  CANCELADO: "CANCELADO",
} as const;

export type EstadoApartado = keyof typeof ESTADO_APARTADO;

export const ESTADO_APARTADO_LABEL: Record<EstadoApartado, string> = {
  PENDIENTE: "Por entregar",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

/** Los únicos apartados sobre los que tienen sentido las acciones */
export const ESTADOS_VIVOS_APARTADO: EstadoApartado[] = [
  ESTADO_APARTADO.PENDIENTE,
];

export const ESTADO_CUENTA = {
  PENDIENTE: "PENDIENTE",
  PAGADA: "PAGADA",
  ANULADA: "ANULADA",
  // El restaurante perdonó el saldo restante (con o sin abonos): los abonos
  // siguen siendo dinero recibido, la condonación NO lo es.
  CONDONADA: "CONDONADA",
} as const;

export type EstadoCuenta = keyof typeof ESTADO_CUENTA;

export const ESTADO_CUENTA_LABEL: Record<EstadoCuenta, string> = {
  PENDIENTE: "Por cobrar",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
  CONDONADA: "Condonada",
};

export const CATEGORIA_GASTO = {
  INGREDIENTES: "INGREDIENTES",
  BEBIDAS: "BEBIDAS",
  SERVICIOS: "SERVICIOS",
  UTENSILIOS: "UTENSILIOS",
  TRANSPORTE: "TRANSPORTE",
  OTROS: "OTROS",
} as const;

export type CategoriaGasto = keyof typeof CATEGORIA_GASTO;

export const CATEGORIA_GASTO_LABEL: Record<CategoriaGasto, string> = {
  INGREDIENTES: "Ingredientes",
  BEBIDAS: "Bebidas",
  SERVICIOS: "Servicios",
  UTENSILIOS: "Utensilios",
  TRANSPORTE: "Transporte",
  OTROS: "Otros",
};

export const ORIGEN_GASTO = {
  CAJA: "CAJA",
  EXTERNO: "EXTERNO",
} as const;

export const ORIGEN_GASTO_LABEL: Record<keyof typeof ORIGEN_GASTO, string> = {
  CAJA: "Caja",
  EXTERNO: "Dinero externo",
};
