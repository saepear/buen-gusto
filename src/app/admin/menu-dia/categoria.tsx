"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useRef, useState, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { ArrowUpRight, Check, Plus, X } from "lucide-react";
import styles from "./menu.module.css";

gsap.registerPlugin(useGSAP);

export function AgregarProducto({ nombre }: { nombre: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={styles.addProduct}>
    <span>{nombre}</span><span>{pending ? "Agregando…" : <Plus aria-label="Agregar al menú" size={18} />}</span>
  </button>;
}

export function CategoriaMenu({ titulo, icono, nombres, cantidad, children }: {
  titulo: string; icono: ReactNode; nombres: string[]; cantidad: number; children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [origen, setOrigen] = useState<DOMRect | null>(null);
  return <>
    <button ref={trigger} type="button" className={styles.categoryTile} aria-haspopup="dialog"
      onClick={() => setOrigen(trigger.current!.getBoundingClientRect())}>
      <span className={styles.tileTop}><span className={styles.tileIcon}>{icono}</span><ArrowUpRight size={20} /></span>
      <strong>{titulo}</strong>
      <span className={styles.tileNames}>{nombres.slice(0, 3).join(" · ") || "Elige qué servirás hoy"}{nombres.length > 3 ? "…" : ""}</span>
      <span className={styles.tileFooter}><span><Check size={14} /> {cantidad} en el menú</span><span>Elegir productos →</span></span>
    </button>
    {origen && createPortal(<EditorCategoria titulo={titulo} icono={icono} origen={origen}
      onClose={() => { setOrigen(null); trigger.current?.focus(); }}>{children}</EditorCategoria>, document.body)}
  </>;
}

function EditorCategoria({ titulo, icono, origen, onClose, children }: {
  titulo: string; icono: ReactNode; origen: DOMRect; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const { contextSafe } = useGSAP(() => {
    const element = dialog.current!;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const rect = element.getBoundingClientRect();
      gsap.fromTo(element, {
        x: origen.x + origen.width / 2 - rect.x - rect.width / 2,
        y: origen.y + origen.height / 2 - rect.y - rect.height / 2,
        scaleX: origen.width / rect.width, scaleY: origen.height / rect.height, opacity: 0,
      }, { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: .5, ease: "power4.out" });
      gsap.from(element.querySelectorAll("[data-menu-anim]"), { opacity: 0, y: 12, delay: .18, duration: .3, stagger: .06 });
    }
    return () => { document.body.style.overflow = overflow; element.close(); };
  }, { scope: dialog });

  const cerrar = () => {
    if (closing.current) return;
    closing.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onClose(); return; }
    contextSafe(() => {
      gsap.to(dialog.current, { opacity: 0, scale: .94, y: 16, duration: .22, ease: "power2.in", onComplete: onClose });
    })();
  };

  return <dialog ref={dialog} className={styles.editor} aria-labelledby="categoria-menu-titulo"
    onCancel={e => { e.preventDefault(); cerrar(); }}
    onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cerrar(); } }}>
    <header className={styles.editorHeader} data-menu-anim>
      <span className={styles.tileIcon}>{icono}</span>
      <div><p className={styles.eyebrow}>MENÚ DE HOY</p><h2 id="categoria-menu-titulo">{titulo}</h2></div>
      <button type="button" autoFocus onClick={cerrar} aria-label="Cerrar categoría"><X /></button>
    </header>
    <div className={styles.editorBody} data-menu-anim>{children}</div>
    <footer className={styles.editorFooter}><span>Los cambios se guardan con cada acción.</span><button type="button" onClick={cerrar}>Listo <Check size={16} /></button></footer>
  </dialog>;
}
