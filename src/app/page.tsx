import { redirect } from "next/navigation";
import { destinoRol } from "@/lib/roles";
import { getSesion } from "@/lib/session";

export default async function Home() {
  const sesion = await getSesion();
  if (sesion) redirect(destinoRol(sesion.rol));
  redirect("/login");
}

