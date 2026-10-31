// Puente local de WhatsApp para El Buen Gusto (Baileys).
//
// Qué hace:
//   - Abre una sesión de WhatsApp Web con el número del negocio (escaneas un
//     QR la primera vez; la sesión queda guardada en ./auth).
//   - ENTRADA: cada mensaje que llega de un cliente lo reenvía al sistema local
//     (POST {APP_URL}/api/whatsapp/entrante) con el secreto compartido.
//   - SALIDA: expone POST /enviar para que el sistema le pida responder al
//     cliente ("pedido anotado", "va en camino"...).
//
// Cómo se corre (sin hosting, todo en la misma PC del local):
//   1) npm run bridge:install      (una sola vez)
//   2) npm run bridge              (déjalo abierto junto a `npm run dev`)
//   3) Escanea el QR con el WhatsApp del negocio (Dispositivos vinculados).
//
// Variables de entorno (las toma de la raíz del proyecto al exportarlas, o del
// .env si lo cargas con tu shell):
//   APP_URL                     → http://127.0.0.1:3000   (sistema local)
//   WHATSAPP_BRIDGE_SECRET      → el mismo secreto del .env del sistema
//   WHATSAPP_BRIDGE_PORT        → 3100 por defecto
import http from "node:http";
import { fileURLToPath } from "node:url";
import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";

const APP_URL = (process.env.APP_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const SECRET = process.env.WHATSAPP_BRIDGE_SECRET ?? "";
const PORT = Number(process.env.WHATSAPP_BRIDGE_PORT ?? 3100);
// Carpeta de la sesión: convertir la URL de node a RUTA de Windows de verdad
// (con .pathname un espacio en el nombre de la carpeta queda grabado como
// "%20" y la sesión vivo en una carpeta fantasma indescifrable)
const AUTH_DIR = fileURLToPath(new URL("./auth", import.meta.url));

if (!SECRET) {
  console.error("✖ Falta WHATSAPP_BRIDGE_SECRET. Pon el mismo secreto del .env del sistema.");
  process.exit(1);
}

const logger = pino({ level: "silent" });

/** México/Colombia y vecinos: un móvil de 10 dígitos que arranca en 3 es CO. */
function aJid(digitos) {
  const d = String(digitos ?? "").replace(/\D/g, "");
  const e164 = d.length === 10 && d.startsWith("3") ? `57${d}` : d;
  return `${e164}@s.whatsapp.net`;
}

let sock = null;

function textoDelMensaje(msg) {
  const m = msg.message;
  if (!m) return "";
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    ""
  ).trim();
}

async function reenviarAlSistema(msg) {
  const jid = msg.key?.remoteJid ?? "";
  // Solo chats individuales: fuera grupos, estados y difusión
  if (!jid.endsWith("@s.whatsapp.net")) return;
  if (msg.key.fromMe) return;

  const texto = textoDelMensaje(msg);
  if (texto.length < 2) return;

  const telefono = jid.split("@")[0];
  const nombre = msg.pushName ?? "";
  try {
    const res = await fetch(`${APP_URL}/api/whatsapp/entrante`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-puente-secreto": SECRET },
      body: JSON.stringify({ telefono, nombre, texto }),
    });
    const data = await res.json().catch(() => ({}));
    console.log(`↘ ${telefono} «${texto.slice(0, 60)}» →`, data.motivo ?? (data.registrado ? "domicilio creado" : "guardado"));
  } catch (e) {
    console.error("✖ No se pudo avisar al sistema (¿está corriendo npm run dev?):", e.message);
  }
}

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) await reenviarAlSistema(msg);
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\n📱 Escanea este QR con el WhatsApp del negocio (Dispositivos vinculados):\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      console.log(`✔ WhatsApp conectado como ${sock.user?.id ?? "?"} · escuchando mensajes…\n`);
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.error("✖ Sesión cerrada desde el teléfono. Borra whatsapp-bridge/auth y vuelve a escanear.");
        process.exit(1);
      }
      console.log("… reconectando");
      setTimeout(() => void iniciar(), 2000);
    }
  });
}

/** API interna que el sistema usa para responder al cliente */
const server = http.createServer((req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (req.headers["x-puente-secreto"] !== SECRET) return json(401, { ok: false, error: "No autorizado." });

  if (req.method === "GET" && req.url === "/estado") {
    return json(200, {
      ok: true,
      conectado: Boolean(sock?.user),
      // Qué WhatsApp está vinculado (+573xxxxx@s.whatsapp.net), para
      // verificar en pantalla que sea el número del negocio
      usuario: sock?.user?.id ?? null,
    });
  }

  if (req.method === "POST" && req.url === "/enviar") {
    let cuerpo = "";
    req.on("data", (c) => {
      cuerpo += c;
      if (cuerpo.length > 100_000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const { telefono, texto } = JSON.parse(cuerpo || "{}");
        if (!telefono || !texto) return json(400, { ok: false, error: "Faltan datos." });
        if (!sock?.user) return json(503, { ok: false, error: "WhatsApp no conectado." });
        await sock.sendMessage(aJid(telefono), { text: String(texto) });
        console.log(`↗ respuesta a ${telefono}`);
        return json(200, { ok: true });
      } catch (e) {
        return json(500, { ok: false, error: e.message });
      }
    });
    return;
  }

  return json(404, { ok: false, error: "Ruta no encontrada." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`🔌 Puente de WhatsApp escuchando en http://127.0.0.1:${PORT}`);
  console.log(`   Sistema: ${APP_URL}\n`);
});

void iniciar();
