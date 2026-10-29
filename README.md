# 🍜 El Buen Gusto — Sistema POS de almuerzos

Sistema de punto de venta web para restaurantes de **solo almuerzos** (corrientazo):
el mesero toma el pedido desde su teléfono, la cocina recibe la comanda al
instante (KDS + impresora de tickets) y el panel del administrador maneja el
menú del día, el stock en porciones y la caja.

## 📱 Vista

| Rol | Pantalla |
|---|---|
| **Administrador** | `/admin` — panel de escritorio con sidebar estricto |
| **Mesero** | `/mesero` — interfaz táctil para el teléfono |
| **Cocina** | `/cocina` — pantalla KDS oscura a todo pantalla |

## 🚀 Cómo correrlo

Requiere Node.js ≥ 20 (en este equipo ya está configurado de forma portable).

```bash
npm install       # solo si se clona nuevo
npm run db:push   # crea la base de datos SQLite (prisma/dev.db)
npm run db:seed   # usuarios de ejemplo, 10 mesas, catálogo y menú de hoy
npm run dev       # servidor en toda la red local (http://0.0.0.0:3000)
```

En la PC del administrador abre `http://localhost:3000`.
En los teléfonos de los meseros y en la pantalla de cocina:
`http://IP-DE-LA-PC:3000` (averigua la IP con `ipconfig` → Adaptador WLAN →
Dirección IPv4). La primera vez, Windows puede pedir permiso para compartir el
puerto 3000 en la red — acepta (red privada).

## 🔐 PINs iniciales (cambiables luego)

| Rol | Usuario | PIN |
|---|---|---|
| Administrador | Administrador | **1234** |
| Mesero | Laura | **1111** |
| Mesero | Carlos | **2222** |
| Cocina | Chef de cocina | **3333** |

## 🗂 Estructura

```
src/
├── app/
│   ├── login/            # PIN por rol (formulario táctil)
│   ├── admin/            # Panel con sidebar (Inicio, Mesas, Menú del día,
│   │                     #   Productos, Caja, Reportes, Configuración)
│   ├── mesero/           # Teléfono del mesero
│   └── cocina/           # Pantalla de comandas
├── components/           # Sidebar, encabezados, estados
└── lib/
    ├── db.ts             # Cliente Prisma
    ├── session.ts        # Sesiones firmadas (cookie httpOnly, HMAC)
    ├── roles.ts          # Constantes de roles/estados del sistema
    └── format.ts         # Formato COP y fechas (es-CO)
prisma/
├── schema.prisma         # Modelo completo: usuarios, productos, menú del día,
│                         #   stock por porciones, mesas, pedidos y pagos
└── seed.ts               # Datos iniciales
```

## ✅ Progreso por fases

- [x] **Fase 1** — Proyecto, base de datos completa, login por PIN con roles,
      layout del admin (vistas con sidebar), vista del mesero y KDS de cocina
- [x] **Fase 2** — Panel admin: crear productos, editar precios y armar el menú del día
      con porciones (stock en vivo, ilimitados, agregar/quitar)
- [x] **Fase 3** — Mesero: tomar pedidos por mesa (con/sin sopa, principios,
      bebidas y adicionales), porciones descontadas de forma atómica, mesa →
      OCUPADA, comanda con nota
- [x] **Cocina (integrada en Fase 3)** — KDS con 3 columnas (Por cocinar →
      En la olla → Listas para servir), transiciones, cancelar
      con devolución de porciones, auto-refresco cada 20 s y ticket
      imprimible de 80 mm en `/cocina/comanda/[id]`
- [x] **Fase 4** — Caja: cobrar mesas (efectivo, tarjeta o transferencia) con
      propina opcional, recibo del cliente imprimible en 80 mm y mesa liberada
      automáticamente
- [x] **Fase 5** — Reportes: cobrado del día, ticket promedio, desglose por
      método, almuerzos servidos por proteína, extras vendidos, ingresos por
      hora y comparativa de los últimos 7 días; cierre de caja con comprobante
      diario (efectivo contado vs. sistema, diferencia sobra/faltan)
- [x] **Fase 6** — Configuración avanzada: crear usuarios con su PIN por rol,
      cambiar PINs (único dentro del rol), activar/desactivar personal
      (reactivado vuelve a entrar), agregar u ocultar mesas (solo si están
      libres; lo oculto sale de mesero/caja) y guía de conexión de la
      impresora de tickets de 80 mm
- [x] **Fase 7** — Precios del almuerzo: **en mesa** completo $13.000 /
      bandeja (sin sopa) $12.000 · **para llevar** completo $14.500 /
      bandeja $13.000 · huevo +$1.000 · adicional de carne +$5.000 (todo en
      `src/lib/precios.ts`). El precio del almuerzo queda fijado en la línea
      de la proteína al ordenar: aunque el catálogo cambie, las comandas
      cobradas y los recibos históricos no se mueven. Toggle **En mesa /
      Para llevar** por comanda con badge en KDS, mesa, caja, ticket y
      recibo (`*** PARA LLEVAR · ICOPOR ***`). El admin puede **ocultar al
      mesero** cualquier ítem del menú del día que se agote antes de tiempo
      (ojo en una sola fila, sin borrarlo); los básicos (asadas y frijoles)
      se agregan solos al crear el menú del día. Sopa y principios van a
      $0; la nota del ticket cubre "sin arroz", "huevo blando", etc.
- [x] **Fase 8** — **Ensaladas con apartado propio**: nuevo tipo de producto
      `ENSALADA` (no es principio); el formulario del mesero muestra la
      tarjeta «Ensalada» aparte (verde, dulce, frutas…) todas incluidas en
      el precio, con porciones y venta como cualquier ítem del menú. El
      **arroz sale del catálogo** (la nota del ticket sigue cubriendo
      «sin arroz» por si la cocina lo sirve de serie en la bandeja).
      **Eliminar**: el admin puede **eliminar productos** (borrado suave:
      sale del catálogo y del menú del día, el historial no se toca y luego
      se reactiva) y quitar ítems del menú del día con el bote de basura
      de cada fila.
- [x] **Fase 9** — **Instalable en el teléfono (Android / iOS / tablet)**:
      manifest PWA + iconos generados desde el logo, sin zoom accidental
      (`user-scalable=no` a propósito en un POS táctil) y `viewport-fit`,
      áreas seguras para la muesca/notch (header, barra flotante del
      pedido, KDS, admin y login), sin rebote ni «tirar para recargar»,
      botón **Cocina (en vivo)** en el sidebar para que el admin siga las
      comandas en tiempo real sin poder tocarlas, y anchos para tablet en
      el lado del mesero. Para instalar: menú del navegador → «Añadir a
      pantalla de inicio» / «Instalar aplicación».
