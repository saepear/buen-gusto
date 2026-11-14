"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const eventSource = new EventSource("/api/realtime");

    eventSource.onmessage = () => {
      // Cuando recibimos cualquier evento, refrescamos los datos de la página actual
      router.refresh();
    };

    eventSource.onerror = () => {
      console.error("Error en la conexión de tiempo real. Reintentando...");
      // EventSource se reconecta automáticamente. Cerrarlo aquí dejaba
      // el POS sin actualizaciones después de cualquier corte de red.
    };

    return () => {
      eventSource.close();
    };
  }, [router]);

  return null;
}

