type Subscriber = (data: string) => void;

class RealtimeManager {
  private subscribers: Set<Subscriber> = new Set();

  subscribe(callback: Subscriber) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  broadcast(event: string, data: any = {}) {
    const payload = JSON.stringify({ event, data, timestamp: Date.now() });
    this.subscribers.forEach((cb) => cb(payload));
  }
}

// Persistir entre recargas de Next.js en desarrollo
const globalRealtime = globalThis as unknown as { realtimeManager?: RealtimeManager };

export const realtime = globalRealtime.realtimeManager ?? new RealtimeManager();

if (process.env.NODE_ENV !== "production") {
  globalRealtime.realtimeManager = realtime;
}
