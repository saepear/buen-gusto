import type { NextConfig } from "next";

// Producción se compila aparte en `.next-prod` (con PROD_BUILD=1, ver los
// scripts de package.json): así el servidor de desarrollo nunca borra el
// build de producción y ambos pueden correr juntos (dev :3000, prod :3001).
const nextConfig: NextConfig = {
  distDir: process.env.PROD_BUILD === "1" ? ".next-prod" : ".next",
  /* POS 100% dinámico (tiempo real): sin Cache Components */
  /* cacheComponents: true, */
  /* partialPrefetching: true, */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Deja que el teléfono (misma WiFi) use el servidor de desarrollo.
  // Comodines por rango: la IP del equipo cambia con el DHCP.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
