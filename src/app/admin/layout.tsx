import { AdminShell } from "@/components/admin-shell";
import { requerirRol } from "@/lib/session";

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const sesion = await requerirRol("ADMIN");

  return <AdminShell nombre={sesion.nombre}>{children}</AdminShell>;
}
