import { SidebarAdmin } from "@/components/sidebar-admin";
import { requerirRol } from "@/lib/session";

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const sesion = await requerirRol("ADMIN");

  return (
    <div className="flex min-h-screen bg-cream-50">
      <SidebarAdmin nombre={sesion.nombre} />
      <div className="min-w-0 flex-1 lg:pl-64">
        <main className="mx-auto max-w-6xl p-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
