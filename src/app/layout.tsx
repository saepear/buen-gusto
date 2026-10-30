import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getTemaActual } from "@/lib/config";

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: {
    default: "El Buen Gusto · POS",
    template: "%s · El Buen Gusto",
  },
  description: "Sistema de punto de venta para restaurantes de almuerzos",
  // Instalable como app en el teléfono
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "El Buen Gusto",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

/** Móvil: escala exacta, sin zoom accidental y respetando la muesca */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#241006",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = await getTemaActual();
  const claseTema = tema === "light" ? "tema-claro" : "";

  return (
    <html lang="es" className={`${fredoka.variable} ${nunito.variable} ${claseTema} h-full antialiased`}>
      <body className="min-h-full bg-fondo-app font-sans text-texto-app">
        {children}
        <RealtimeRefresh />
      </body>
    </html>
  );
}

