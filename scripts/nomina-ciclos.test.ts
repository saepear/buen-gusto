import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularPago } from "../src/lib/nomina/pago";
import type { ContratoFoto } from "../src/lib/nomina/calculo";
import { salarioDelCiclo } from "../src/lib/nomina/salario-ciclo";
const contrato: ContratoFoto = { modalidad: "LABORAL", remuneracion: "MENSUAL", salarioMensual: 1485000, salarioDiario: 70000, valorHora: 10000, jornadaSemanalMinutos: 2520, periodicidadPago: "CICLOS", diaDescanso: 0, auxilioTransporte: false, metodoPago: "EFECTIVO", arpClase: 1 };
const calcular = (desde: string, hasta: string, cambio: Partial<ContratoFoto> = {}, tipo = "CICLOS") => calcularPago({contrato: {...contrato,...cambio}, novedades: [], periodoDesde: desde, periodoHasta: hasta, periodoTipo: tipo});
test("Cristian: 371250 en cada corte, incluidos meses de 28 a 31 días", () => {
 for (const [mes,ultimo] of [['2027-02',28],['2028-02',29],['2026-11',30],['2026-12',31]] as const) {
  const valores = [[1,7],[8,14],[15,21],[22,ultimo]].map(([a,b]) => calcular(`${mes}-${String(a).padStart(2,'0')}`,`${mes}-${String(b).padStart(2,'0')}`).salarioBase);
  assert.deepEqual(valores,[371250,371250,371250,371250]); assert.equal(valores.reduce((a,b)=>a+b),1485000);
 }
});
test("el último corte conserva el total mensual con redondeos",()=>{
 for (const salario of [1485001,1485002,1485003]) assert.equal([1,8,15,22].reduce((s,d)=>s+salarioDelCiclo(salario,`2026-01-${String(d).padStart(2,'0')}`),0),salario);
});
test("otros períodos y remuneraciones conservan su cálculo",()=>{
 assert.equal(calcular('2026-01-01','2026-01-31',{},'MENSUAL').salarioBase,1485000);
 assert.equal(calcular('2026-01-01','2026-01-07',{remuneracion:'DIARIO'}).salarioBase,490000);
 assert.equal(calcular('2026-01-01','2026-01-07',{remuneracion:'HORARIO'}).salarioBase,420000);
 assert.equal(calcular('2026-01-01','2026-01-07',{modalidad:'INDEPENDIENTE'}).salarioBase,371250);
});
test("los descuentos se aplican después de dividir el salario",()=>{
 const r=calcularPago({contrato,novedades:[{id:1,tipo:'DESCUENTO',fecha:'2026-01-02',dias:null,valor:6000,descripcion:'Vale'}],periodoDesde:'2026-01-01',periodoHasta:'2026-01-07',periodoTipo:'CICLOS'});
 assert.equal(r.salarioBase,371250);assert.equal(r.otrosDescuentos,6000);assert.equal(r.netoAPagar,r.totalDevengado-r.totalDeducciones);
 assert.match(r.conceptos.find(c=>c.clave==='SALARIO')!.detalle!,/÷ 4/);
});
