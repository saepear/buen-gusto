"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Refresca la pantalla del KDS sin que nadie la toque */
export function AutoRefresco({ segundos = 20 }: { segundos?: number }) {
  const router = useRouter();
  const [actualizada, setActualizada] = useState<string | null>(null);

  useEffect(() => {
    const actualizar = () => {
      router.refresh();
      setActualizada(
        new Date().toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    const id = window.setInterval(actualizar, segundos * 1000);
    return () => window.clearInterval(id);
  }, [router, segundos]);

  return (
    <span className="flex items-center gap-1.5 text-[11px] text-cream-200/60">
      <RefreshCw className="h-3 w-3" />
      Auto cada {segundos}s
      {actualizada ? ` · ${actualizada}` : ""}
    </span>
  );
}
