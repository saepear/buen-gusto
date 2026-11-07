import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPago } from '../src/lib/nomina/pago';
import type { ContratoFoto } from '../src/lib/nomina/calculo';
const contrato: ContratoFoto = {modalidad:'LABORAL',remuneracion:'MENSUAL',salarioMensual:1485000,salarioDiario:60000,valorHora:10000,jornadaSemanalMinutos:2520,periodicidadPago:'CICLOS',diaDescanso:0,auxilioTransporte:true,metodoPago:'EFECTIVO',arpClase:1};
const args = {contrato,novedades:[],periodoDesde:'2026-11-01',periodoHasta:'2026-11-07',periodoTipo:'CICLOS'};
test('pago de la referencia: 371250 + 5000 = 376250 sin cargos automáticos',()=>{
 const r=calcularPago({...args,novedades:[{id:1,tipo:'BONIFICACION',valor:5000,descripcion:'Extra',fecha:'2026-11-01',dias:null}]});
 assert.equal(r.salarioBase,371250); assert.equal(r.netoAPagar,376250);
 for(const k of ['deduccionSalud','deduccionPension','auxilioTransporte','empresaSalud','empresaPension','empresaRiesgos','empresaCaja','prestacionPrima','prestacionCesantias','prestacionIntereses','prestacionVacaciones'] as const) assert.equal(r[k],0,k);
 assert.deepEqual(r.conceptos.map(c=>c.tipo),['DEVENGADO','DEVENGADO']);
});
test('deducciones manuales y vales conservan concepto e importe',()=>{
 const r=calcularPago({...args,novedades:[{id:2,tipo:'DESCUENTO',valor:10000,descripcion:'Anticipo',fecha:'2026-11-01',dias:null},{id:0,tipo:'DESCUENTO',valor:6000,descripcion:'Vale: bebida',fecha:'2026-11-01',dias:null}]});
 assert.equal(r.netoAPagar,355250);assert.equal(r.totalDeducciones,16000);assert.equal(r.conceptos[1].etiqueta,'Anticipo');assert.equal(r.conceptos[1].clave,'AJUSTE_2');
});
test('ausencias no descuentan automáticamente y no dependen de modalidad',()=>{
 const r=calcularPago({...args,contrato:{...contrato,modalidad:'INDEPENDIENTE'},novedades:[{id:3,tipo:'AUSENCIA',valor:null,dias:2,fecha:'2026-11-01',descripcion:'Registro de ausencia'}]});
 assert.equal(r.netoAPagar,371250);
});
test('cuatro cortes conservan el salario y el redondeo',()=>{
 for(const salarioMensual of [1485000,1485001,1485002,1485003]) {
  const total=[1,8,15,22].reduce((s,d)=>s+calcularPago({...args,contrato:{...contrato,salarioMensual},periodoDesde:`2026-11-${String(d).padStart(2,'0')}`}).netoAPagar,0);
  assert.equal(total,salarioMensual);
 }
});
