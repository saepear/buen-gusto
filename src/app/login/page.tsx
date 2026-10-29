import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { rutaLogo } from "@/lib/logo";
import { destinoRol } from "@/lib/roles";
import { getSesion } from "@/lib/session";
import Image from "next/image";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  const sesion = await getSesion();
  if (sesion) redirect(destinoRol(sesion.rol));
  const logo = rutaLogo();

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* Panel de marca (escritorio) */}
      <section className="hidden lg:flex flex-col items-center justify-center gap-8 bg-brown-950 p-12">
        <Image
          src={logo.src}
          alt="El Buen Gusto Restaurante"
          width={logo.esArchivo ? 420 : 340}
          height={logo.esArchivo ? 480 : 340}
          unoptimized={logo.esArchivo}
          priority
        />
        <div className="max-w-md text-center">
          <h1 className="font-display text-4xl text-amber-brand">
            Menús de almuerzo, sin papeleos
          </h1>
          <p className="mt-3 text-lg text-cream-200/85">
            El mesero pide desde su teléfono, la cocina recibe su comanda al
            instante y el stock se descuenta en tiempo real.
          </p>
        </div>
        <div className="grid w-full max-w-lg grid-cols-3 gap-4 text-center">
          {[
            { t: "Pedido rápido", d: "Desde el celular" },
            { t: "Comanda instantánea", d: "Directo a cocina" },
            { t: "Stock en vivo", d: "Porciones exactas" },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl bg-brown-800/70 p-4">
              <p className="font-semibold text-cream-100">{f.t}</p>
              <p className="mt-1 text-sm text-amber-brand/90">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Login (o panel derecho) — con aire para la barra del sistema */}
      <section className="flex min-h-screen items-center justify-center bg-cream-100 p-6 pie-seguro">
        <FormularioLogin logoSrc={logo.src} />
      </section>
    </main>
  );
}
