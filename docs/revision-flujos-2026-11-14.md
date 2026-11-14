# Revisión de flujos · 14 de noviembre de 2026

Se revisaron las rutas principales con un usuario y una base temporal de QA, sin registrar ventas ni pagos de prueba en la base real. Se mantuvo la impresión normal del navegador; no se añadió un simulador a la aplicación.

## Errores corregidos

- Las comandas carecían de la marca que aísla el ticket al imprimir. Ahora la impresión excluye la navegación, y los importes no se parten entre líneas.
- Domicilios no enviaba la comanda a imprimir al crearse, pese al texto que indicaba ese comportamiento. La comanda y las facturas de cobro abren ahora la impresión automática una vez por visita.
- El recibo de mesa infería sus comandas comparando fechas de creación con el pago anterior. El cobro guarda ahora una foto del lote exacto, sus artículos y quién cobró. Los recibos antiguos muestran únicamente la comanda que tienen vinculada, porque no se puede reconstruir con certeza el lote perdido.
- Renombrar un producto del catálogo cambiaba el nombre visible de ventas pasadas. Se prioriza el nombre congelado en cada línea.
- Eliminar un producto referenciado por vales fallaba por la relación al catálogo. Se conserva la foto del vale y se desvincula el producto.
- Mesas y Mesero omitían comandas activas de días anteriores, aunque Caja sí podía cobrarlas. Las pantallas incluyen todos los pedidos activos.
- La reserva atómica de stock no descontaba las porciones comprometidas en apartados. La guardia verifica las reservas pendientes dentro del mismo UPDATE; una entrega excluye únicamente sus propias reservas.
- La apertura de jornadas de nómina podía dejar empleados preparados a medias y marcar vales como descontados antes de pagar. Apertura, cálculos y vínculos se guardan ahora en una sola transacción. Únicamente los netos de cero se saldan al abrir.
- Un empleado con su rango pagado se trataba como un error al preparar al resto. Ahora se omite sin generar otro sueldo.
- Las entregas de nómina validan jornada, saldo, total revisado y cierre de efectivo en la misma transacción. Se probó el envío simultáneo de dos solicitudes: solo una puede completar el saldo.
- Un empleado retirado con un pago pendiente en una jornada abierta desaparecía del panel operativo. Sigue visible hasta resolver esa entrega.
- Los formularios históricos permitían intentar ajustes y pagos fuera de una jornada abierta. La interfaz y el servidor aplican la misma restricción.
- Registrar un gasto comprobaba el cierre fuera de la transacción. La comprobación y el registro son ahora una sola operación. También se bloquea anular un gasto de una caja histórica cerrada o anular aisladamente el egreso de un pago de nómina/crédito.
- Reportes y Excel omitían el efectivo recibido en anticipos. Se incluye por separado de las ventas; consumir el anticipo no vuelve a generar ingresos.
- La fecha del turno dependía de la zona horaria del servidor. Se fija America/Bogota y se validan las fechas de consulta/exportación.
- Un corte de red cerraba definitivamente EventSource. Se conserva su reconexión automática.
- El selector de pedidos de Fiados podía aplicar una respuesta atrasada al cambiar de cliente. Se descartan las respuestas de la selección anterior.

## Verificación

- Recorrido de 13 módulos principales en navegador con datos temporales.
- `npm run test:flujos`: recibos congelados, zona horaria, apertura atómica de jornadas, vales, abonos, solicitudes simultáneas, cierre automático, protección del mismo rango y anticipos en reportes.
- `npm run test:nomina` y `npm run test:consecutivos`.
- `npm run lint` y `npm run build`.

Las comprobaciones cubren los escenarios descritos; no equivalen a una garantía de ausencia de errores en todos los datos históricos o combinaciones de uso.

## Pruebas de impresión sin impresora física

Windows ya tiene instalada **Microsoft Print to PDF**: se puede elegir desde el botón normal de imprimir y abrir el archivo resultante.

Para ensayar tamaños de papel personalizados, **PDF24 Creator** ofrece una impresora virtual. Su impresora clásica (PostScript) permite un ancho de 80 mm y una altura definida para las pruebas. La variante driverless tiene restricciones de tamaños personalizados. Elegir escala 100 % y desactivar encabezados/pies del navegador. Un PDF comprueba la composición enviada por el navegador; el corte de papel, la densidad y los márgenes físicos dependen del equipo real.

- Descarga oficial: https://tools.pdf24.org/es/creator
- Tamaños personalizados: https://help.pdf24.org/en/change-pdf-page-size/
- Guardado automático y apertura del resultado: https://help.pdf24.org/en/how-to-create-pdf-files-with-pdf24/
