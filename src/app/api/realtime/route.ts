import { NextRequest } from "next/server";
import { realtime } from "@/lib/realtime";

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Suscribirse a cambios
      const unsubscribe = realtime.subscribe(sendEvent);

      // Mantener la conexión viva con un ping cada 30s
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 30000);

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(keepAlive);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
