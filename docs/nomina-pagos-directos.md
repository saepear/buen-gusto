# Nómina: pagos directos, vales y créditos

El administrador abre la ficha de una persona y registra la entrega desde el mismo modal. El sistema prepara las fechas y descuentos; no necesita crear, aprobar ni cerrar ciclos. Los períodos siguen siendo referencias internas para conservar comprobantes y evitar pagar dos veces el mismo sueldo.

## Calendario por empleado

- Semanal: 7, 14, 21 y último día del mes; salario mensual dividido entre cuatro, con ajuste de redondeo en el último pago.
- Quincenal: 15 y último día; salario dividido entre dos.
- Mensual: último día; salario completo.

La frecuencia se cambia en el perfil del empleado. Se permite registrar entregas antes y después de la fecha. Se atiende primero un pago abierto pendiente; si el correspondiente a hoy ya está completo, se ofrece el siguiente. Los pagos anteriores que se superpongan con un nuevo calendario impiden duplicar el sueldo. Un cambio de frecuencia no modifica comprobantes ni borradores ya existentes.

## Descuentos

Los vales se autorizan al registrarlos por el administrador y se incluyen en el siguiente pago disponible cuya fecha final alcance la entrega. También se recogen vales pendientes del sistema anterior y descuentos atrasados. Abrir un pago solo reserva el vale: queda descontado cuando el pago se salda. Un vale del 11 de noviembre entra en el pago semanal del 14, aunque el borrador se hubiera abierto antes de registrar el consumo.

Un crédito registra importe, motivo, empleado, método de entrega y un plan de cuotas. Cada cuota tiene fecha e importe propios y la suma debe coincidir con el préstamo. La propuesta mensual permite elegir la primera fecha y editar toda la distribución; no obliga a usar fin de mes. Una cuota se incluye en el pago que cubra su fecha o el siguiente disponible. Un crédito en efectivo registra la salida de caja en la misma transacción y respeta el cierre de caja.

Un pago con dinero entregado conserva su importe: los vales o cuotas nuevos van al siguiente pago. Si el total cambió desde que el administrador lo revisó, se exige revisar el desglose actualizado antes de entregar. Los descuentos no pueden superar el sueldo disponible. Un neto de cero se puede confirmar sin crear una salida ficticia de caja.

El historial conserva los pagos anteriores, sus conceptos y comprobantes. Los períodos históricos cerrados no se alteran automáticamente.

## Instalación y verificación

La actualización añade `CreditoNomina` y la relación de sus cuotas con `NovedadNomina`. En cada instalación, aplicar `npm run db:push` antes de iniciar esta versión. No elimina registros existentes.

`npm run test:nomina` incluye pruebas del calendario, redondeo, vales, cuotas y conciliación. La prueba de integración crea una base SQLite temporal aislada; nunca modifica los datos del restaurante. `npm run build` valida el compilado de producción.
