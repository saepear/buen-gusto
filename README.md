# 🍜 El Buen Gusto — Sistema POS de almuerzos

Sistema de punto de venta web para restaurantes de **solo almuerzos** (corrientazo):
el mesero toma el pedido desde su teléfono, la cocina recibe la comanda al
instante (KDS + impresora de tickets) y el panel del administrador maneja el
menú del día, el stock en porciones y la caja.



## Cómo correrlo

Requiere Node.js ≥ 20 (en este equipo ya está configurado de forma portable).

```bash
npm install       # solo si se clona nuevo
npm run db:push   # crea la base de datos SQLite (prisma/dev.db)
npm run db:seed   # usuarios de ejemplo, 10 mesas, catálogo y menú de hoy
```

## Operación del día (producción, pantalla limpia)

A diario el sistema corre con los accesos del escritorio (`El Buen Gusto - Sistema`
o `El Buen Gusto - Todo`): compilan una vez a `.next-prod` y arrancan en modo
producción (`next start`, `http://0.0.0.0:3000`). Así la UI sale **sin el botón
flotante de Next.js devtools** que tapaba el botón "Cerrar". Si se cambia código,
corre `compilar-sistema.bat` antes de volver a prender. Para programar con hot
reload se usa `npm run dev` aparte (no se pisa: dev en `.next`, prod en
`.next-prod`).

En la PC del administrador abre `http://localhost:3000`.
En los teléfonos de los meseros y en la pantalla de cocina:
`http://IP-DE-LA-PC:3000` (averigua la IP con `ipconfig` → Adaptador WLAN →
Dirección IPv4). La primera vez, Windows puede pedir permiso para compartir el
puerto 3000 en la red — acepta (red privada).
