// Elegir el logo: /logo.png si el usuario puso su imagen real, si no el SVG.
import fs from "node:fs";
import path from "node:path";

export type InfoLogo = { src: string; esArchivo: boolean };

export function rutaLogo(): InfoLogo {
  let info: InfoLogo = { src: "/logo.svg", esArchivo: false };
  try {
    const candidato = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(candidato)) info = { src: "/logo.png", esArchivo: true };
    else {
      const jpg = path.join(process.cwd(), "public", "logo.jpg");
      if (fs.existsSync(jpg)) info = { src: "/logo.jpg", esArchivo: true };
    }
  } catch {
    /* fallback svg */
  }
  return info;
}
