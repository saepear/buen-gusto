import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
