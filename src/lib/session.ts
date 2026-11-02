// Sesiones firmadas con HMAC (cookie httpOnly). Ligero y sin dependencias.
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { destinoRol, type Rol } from "./roles";

const COOKIE_NAME = "buen_gusto_session";
const MAX_AGE_SEG = 60 * 60 * 12; // 12 horas

/** Resuelve la clave con la que se firman las cookies de sesión.
 *  SIN secretos inseguros por defecto: en producción EXIGE AUTH_SECRET con
 *  32+ caracteres (128 bits de entropía); en desarrollo se admite la corta
 *  del .env con aviso, o un secreto efímero aleatorio de este proceso (las
 *  sesiones dev se invalidan al reiniciar, a propósito). */
function resolverSecreto(): string {
  const valor = process.env.AUTH_SECRET?.trim() ?? "";
  if (valor.length >= 32) return valor;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta o es corta la variable AUTH_SECRET: es la clave con la que se " +
        "firman las cookies de sesión. Escríbela en .env (o en las variables " +
        "del despliegue) con 32+ caracteres aleatorios. Genera una con: " +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  if (valor.length > 0) {
    console.warn(
      "AUTH_SECRET tiene menos de 32 caracteres: solo apéndala el desarrollo; en producción será obligatoria larga.",
    );
    return valor;
  }
  console.warn(
    "AUTH_SECRET no está definida: sesión firmada con un secreto efímero de desarrollo (se reinicia al reiniciar el dev).",
  );
  return crypto.randomBytes(32).toString("base64url");
}

const SECRET = resolverSecreto();

export type Sesion = { id: number; nombre: string; rol: Rol };

function firma(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

function codificar(s: Sesion): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${firma(payload)}`;
}

function decodificar(token?: string | null): Sesion | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const esperada = firma(payload);
  if (sig.length !== esperada.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperada))) return null;
  try {
    const datos = JSON.parse(Buffer.from(payload, "base64url").toString()) as Sesion;
    if (typeof datos?.id !== "number" || typeof datos?.nombre !== "string") return null;
    return datos;
  } catch {
    return null;
  }
}

export async function getSesion(): Promise<Sesion | null> {
  const store = await cookies();
  return decodificar(store.get(COOKIE_NAME)?.value);
}

export async function guardarSesion(s: Sesion): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, codificar(s), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE_SEG,
    path: "/",
  });
}

export async function borrarSesion(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Garantiza sesión y rol antes de renderizar una zona (usa redirect) */
export async function requerirRol(rol: Rol): Promise<Sesion> {
  const s = await getSesion();
  if (!s) redirect("/login");
  if (s.rol !== rol) redirect(destinoRol(s.rol));
  return s;
}

/** Como requerirRol, pero admite varios roles (p. ej. ADMIN y MESERO) */
export async function requerirRolDe(roles: Rol[]): Promise<Sesion> {
  const s = await getSesion();
  if (!s) redirect("/login");
  if (!roles.includes(s.rol)) redirect(destinoRol(s.rol));
  return s;
}

/** Para Server Actions: aborta si el usuario no es admin (sin redirecciones) */
export async function exigirAdmin(): Promise<Sesion> {
  const s = await getSesion();
  if (!s || s.rol !== "ADMIN") throw new Error("No autorizado: solo administradores.");
  return s;
}

/** Para Server Actions: solo roles concretos pueden ejecutar la acción */
export async function exigirActor(roles: Rol[]): Promise<Sesion> {
  const s = await getSesion();
  if (!s || !roles.includes(s.rol)) throw new Error("No autorizado para esta acción.");
  return s;
}
