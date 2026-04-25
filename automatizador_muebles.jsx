import React, { useState, useMemo, useEffect } from 'react';
import { Settings, Save, FolderOpen, Trash2, Download, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

// ============================================================
// PARÁMETROS GLOBALES (las 15 respuestas)
// ============================================================
const DEFAULT_PARAMS = {
  // Bloque A — Reglas universales
  e: 18,            // espesor placa principal (mm)
  eF: 5.5,          // espesor fondo (mm)
  kerf: 3,          // kerf sierra (mm)
  gapPuertas: 2,    // gap entre 2 puertas (mm)
  gapBorde: 1,      // gap puerta vs borde externo (mm por lado)
  gapAlto: 2,       // gap puerta vs borde superior/inferior (mm cada uno)
  descEstantePro: 20, // descuento profundidad de estante (mm)
  descEstanteAncho: 2, // descuento ancho de estante (mm, por lado estante regulable = 1+1)
  margenDespLisa: 10,  // % margen desperdicio placa lisa
  margenDespVeta: 15,  // % margen desperdicio con veta
  descCajonProf: 80,  // descuento profundidad cajón respecto a caja (mm) — el frente cubre
  descLateralCajon: 10, // descuento alto lateral por guía (mm)
  umbralDoblePuerta: 600, // ancho en mm a partir del cual pasa de 1 a 2 puertas

  // Bloque C — Costos
  horaHombre: 3500,  // $/hora (costo directo)
  margenVenta: 1.40, // multiplicador final sobre (materiales + mano obra)

  // Placa
  placaW: 2600,      // ancho placa mm (Egger)
  placaH: 1830,      // alto placa mm
};

// ============================================================
// PRECIOS (abril 2026, SIN IVA)
// ============================================================
const PRECIOS = {
  // Placas $/m²
  melamina: 23100,
  crudo: 15488,
  rauvisioBco: 140659,
  fondo55: 11698,
  // Filos $/m
  abs08: 25.57,
  abs2: 44.57,
  rauvisio1: 5100,
  // Servicios
  laqueado: 152863,  // $/m²
  vidrio: 42700,     // $/puerta
  // Bisagras $/par
  bisN2: 887, bisN3: 2883, bisN4: 3232, bisN5: 1848,
  // Correderas 45cm $/par
  corrN2: 9995, corrN3: 17407, corrN4: 25789, corrN5: 30710,
  // Laterales cajón $/par
  latN2: 0, latN3: 11064, latN4: 13192, latN5: 44379,
  // Pistones $/u
  pistN2: 1057, pistN3: 1057, pistN4: 4667, pistN5: 4667,
  // Estructura
  zocalo: 3274,      // $/m
  pataPVC: 405, pataAl: 989,
  tirador: 2500,
  tornilloKit: 1000, // $ por ml de mueble
  // Accesorios cocina
  cubertero: 12189, pisoBacha: 21790, tachoDoble: 120502,
  magicCorner: 291494, columnaCS: 678772, secaplatos: 77343,
  // LED
  ledTira: 4352, ledPerfil: 3900, ledFuente: 9800, ledDimmer: 9100,
};

// ============================================================
// DEFINICIÓN DE MUEBLES — 15 tipos
// ============================================================

function calcPuertas(L, H, params) {
  const { gapPuertas, gapBorde, gapAlto, umbralDoblePuerta } = params;
  if (L <= umbralDoblePuerta) {
    return [{
      cant: 1,
      w: L - 2 * gapBorde,
      h: H - 2 * gapAlto,
    }];
  }
  return [{
    cant: 2,
    w: (L - 2 * gapBorde - gapPuertas) / 2,
    h: H - 2 * gapAlto,
  }];
}

function bisagrasPorAlto(altoPuerta) {
  if (altoPuerta <= 900) return 2;
  if (altoPuerta <= 1500) return 3;
  if (altoPuerta <= 2200) return 4;
  return 5;
}

function correderaMedida(profMueble) {
  // Prof 58 cm → 45 cm; Prof 40 cm → 35 cm; etc.
  // Regla: (prof − 10) redondeado a múltiplo de 5
  const target = profMueble - 100;
  const opciones = [250, 300, 350, 400, 450, 500, 550, 600];
  return opciones.reduce((best, v) => (v <= target && v > best ? v : best), 250);
}

// Cada mueble: función que recibe L, H, P (mm) y params, devuelve:
//   piezas: array de { nombre, cant, w, h, esp, veta, visible, tipo }
//   puertas: array (para herrajes)
//   cajones: array
//   accesorios: qué accesorios lleva según nivel
//   unidad: 'ml' | 'modulo'
//   led: metros de tira LED en N3+
//   horas: función(L_cm, H_cm) → horas de mano de obra

const MUEBLES = {
  'alacena-madera': {
    nombre: 'Alacena puertas madera',
    ambiente: 'Cocina',
    unidad: 'ml',
    medDefault: { L: 100, H: 72, P: 35 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho } = params;
      const pz = [];
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Estante', cant: 1, w: L - 2*e - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });
      return pz;
    },
    puertas: (L, H, P, params) => calcPuertas(L, H, params),
    cajones: () => [],
    accesorios: (nivel) => ({ secaplatos: 1, led: 1, fuenteLed: 0.2 }),
    horas: (Lcm) => 4 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: false, zocalo: false },
  },

  'alacena-vidrio': {
    nombre: 'Alacena puertas de vidrio',
    ambiente: 'Cocina',
    unidad: 'ml',
    medDefault: { L: 100, H: 72, P: 35 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho } = params;
      const pz = [];
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Estante', cant: 1, w: L - 2*e - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });
      // Las puertas son de vidrio, no se cuentan como piezas de MDF
      return pz;
    },
    puertas: (L, H, P, params) => {
      const pu = calcPuertas(L, H, params);
      return pu.map(p => ({ ...p, vidrio: true }));
    },
    cajones: () => [],
    accesorios: () => ({ secaplatos: 1, led: 1, fuenteLed: 0.2 }),
    horas: (Lcm) => 5 * (Lcm / 100),
    tieneVidrio: true,
    lleva: { patas: false, zocalo: false },
  },

  'bajo-cajonera': {
    nombre: 'Bajo mesada cajonera (3 cajones + 1 puerta)',
    ambiente: 'Cocina',
    unidad: 'ml',
    medDefault: { L: 100, H: 85, P: 58 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho, descLateralCajon, descCajonProf } = params;
      const pz = [];
      // Módulo de 1ml dividido en 2: izq cajonera 50cm, der puerta 50cm
      const anchoCajonera = Math.min(L * 0.5, 450);
      const anchoPuerta = L - anchoCajonera - e;

      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Divisor interno', cant: 1, w: H, h: P, esp: e, veta: 'V', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Travesaño superior', cant: 1, w: L - 2*e, h: 100, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Estante (lado puerta)', cant: 1, w: anchoPuerta - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });

      // Cajones: 150mm + 250mm + 400mm de altura total, pero hay que restar gaps
      const alturas = [150, 250, 400];
      const profCajon = P - descCajonProf;
      alturas.forEach((altoFrente, i) => {
        const altoInterno = altoFrente - descLateralCajon - 10;
        pz.push({ nombre: `Frente cajón ${i+1}`, cant: 1, w: anchoCajonera - params.gapPuertas, h: altoFrente - 2*params.gapAlto, esp: e, veta: 'V', visible: true, tipo: 'frente' });
        pz.push({ nombre: `Lateral cajón ${i+1}`, cant: 2, w: profCajon, h: altoInterno, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
        pz.push({ nombre: `Frente/fondo cajón ${i+1}`, cant: 2, w: anchoCajonera - 2*e, h: altoInterno, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
        pz.push({ nombre: `Piso cajón ${i+1}`, cant: 1, w: anchoCajonera - 2*e, h: profCajon - e, esp: eF, veta: null, visible: false, tipo: 'cajon-piso' });
      });

      return pz;
    },
    puertas: (L, H, P, params) => {
      const anchoCajonera = Math.min(L * 0.5, 450);
      const anchoPuerta = L - anchoCajonera - params.e;
      return [{ cant: 1, w: anchoPuerta - 2*params.gapBorde, h: H - 2*params.gapAlto }];
    },
    cajones: (L, H, P, params) => {
      const anchoCajonera = Math.min(L * 0.5, 450);
      const alturas = [150, 250, 400];
      return alturas.map(altura => ({
        ancho: anchoCajonera,
        alto: altura,
        profundidad: P - params.descCajonProf,
      }));
    },
    accesorios: () => ({ cubertero: 1, pisoBacha: 1, tacho: 0.2 }),
    horas: (Lcm) => 7 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: true, zocalo: true, numPatas: 4 },
  },

  'bajo-2puertas': {
    nombre: 'Bajo mesada 2 puertas',
    ambiente: 'Cocina',
    unidad: 'ml',
    medDefault: { L: 100, H: 85, P: 58 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho } = params;
      const pz = [];
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Travesaño superior', cant: 1, w: L - 2*e, h: 100, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Estante', cant: 1, w: L - 2*e - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });
      return pz;
    },
    puertas: (L, H, P, params) => calcPuertas(L, H, params),
    cajones: () => [],
    accesorios: () => ({ pisoBacha: 1, tacho: 0.2 }),
    horas: (Lcm) => 5 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: true, zocalo: true, numPatas: 4 },
  },

  'torre-horno': {
    nombre: 'Torre de horno',
    ambiente: 'Cocina',
    unidad: 'modulo',
    medDefault: { L: 60, H: 210, P: 60 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho } = params;
      const pz = [];
      const huecoHorno = 600; // 60 cm alto para hueco del horno
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Piso hueco horno', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Techo hueco horno', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Estante superior', cant: 2, w: L - 2*e - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });
      return pz;
    },
    puertas: (L, H, P, params) => {
      // 3 puertas: inferior + superior superior + superior inferior
      const { gapAlto, gapBorde, gapPuertas } = params;
      const altoInf = 800;
      const altoSupBaja = 450;
      const altoSupAlta = 400;
      const anchoPuerta = L - 2*gapBorde;
      return [
        { cant: 1, w: anchoPuerta, h: altoInf - 2*gapAlto, pos: 'inferior' },
        { cant: 1, w: anchoPuerta, h: altoSupBaja - 2*gapAlto, pos: 'superior-baja' },
        { cant: 1, w: anchoPuerta, h: altoSupAlta - 2*gapAlto, pos: 'superior-alta' },
      ];
    },
    cajones: () => [],
    accesorios: () => ({}),
    horas: () => 12,
    tieneVidrio: false,
    lleva: { patas: true, zocalo: true, numPatas: 4 },
  },

  'torre-heladera': {
    nombre: 'Torre de heladera',
    ambiente: 'Cocina',
    unidad: 'modulo',
    medDefault: { L: 75, H: 220, P: 75 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho } = params;
      const pz = [];
      const altoSup = 600;
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Separador heladera', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Estante alacena superior', cant: 1, w: L - 2*e - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      pz.push({ nombre: 'Travesaño posterior superior', cant: 1, w: L - 2*e, h: 100, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      // Sin fondo cerrado: heladera necesita ventilación
      return pz;
    },
    puertas: (L, H, P, params) => {
      const { gapBorde, gapAlto, gapPuertas } = params;
      const altoSup = 600 - 2 * gapAlto;
      // 2 puertas en la alacena superior
      return [{
        cant: 2,
        w: (L - 2*gapBorde - gapPuertas) / 2,
        h: altoSup,
      }];
    },
    cajones: () => [],
    accesorios: () => ({}),
    horas: () => 10,
    tieneVidrio: false,
    lleva: { patas: true, zocalo: true, numPatas: 4 },
  },

  'coffee-station': {
    nombre: 'Coffee station',
    ambiente: 'Cocina',
    unidad: 'ml',
    medDefault: { L: 100, H: 220, P: 40 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho, descLateralCajon, descCajonProf } = params;
      const pz = [];
      const altoCajon = 150;
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Repisa apoyo cafetera', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Estante superior', cant: 1, w: L - 2*e - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });
      // Cajón bajo (para cápsulas)
      const profCajon = P - descCajonProf;
      pz.push({ nombre: 'Frente cajón', cant: 1, w: L - 2*params.gapBorde, h: altoCajon - 2*params.gapAlto, esp: e, veta: 'V', visible: true, tipo: 'frente' });
      pz.push({ nombre: 'Lateral cajón', cant: 2, w: profCajon, h: altoCajon - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
      pz.push({ nombre: 'Frente/fondo cajón', cant: 2, w: L - 2*e, h: altoCajon - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
      pz.push({ nombre: 'Piso cajón', cant: 1, w: L - 2*e, h: profCajon - e, esp: eF, veta: null, visible: false, tipo: 'cajon-piso' });
      return pz;
    },
    puertas: (L, H, P, params) => {
      // 2 puertas superiores (alto entre repisa y techo)
      const altoSup = 800; // aprox
      const { gapBorde, gapAlto, gapPuertas } = params;
      return [{ cant: 2, w: (L - 2*gapBorde - gapPuertas) / 2, h: altoSup - 2*gapAlto }];
    },
    cajones: (L, H, P, params) => [{ ancho: L, alto: 150, profundidad: P - params.descCajonProf }],
    accesorios: () => ({ led: 1, fuenteLed: 0.3 }),
    horas: (Lcm) => 10 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: true, zocalo: true, numPatas: 4 },
  },

  'placard': {
    nombre: 'Placard 3 puertas + cajonera interna',
    ambiente: 'Dormitorio',
    unidad: 'ml',
    medDefault: { L: 100, H: 240, P: 60 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho, descLateralCajon, descCajonProf } = params;
      const pz = [];
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Estante superior (placard alto)', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      // Divisor interno (divide zona ropa / zona cajonera)
      const anchoCajonera = 500;
      const anchoRopa = L - anchoCajonera - e;
      pz.push({ nombre: 'Divisor interno', cant: 1, w: H * 0.7, h: P, esp: e, veta: 'V', visible: false, tipo: 'estructura' });
      // Estantes altos sobre zona ropa
      pz.push({ nombre: 'Estante alto (zona alta)', cant: 1, w: anchoRopa - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      // Fondo
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });
      // Cajonera interna: 3 cajones de 200mm alto
      const profCajon = P - descCajonProf;
      for (let i = 0; i < 3; i++) {
        pz.push({ nombre: `Frente cajón ${i+1}`, cant: 1, w: anchoCajonera - params.gapPuertas, h: 200 - 2*params.gapAlto, esp: e, veta: 'V', visible: false, tipo: 'cajon-frente' });
        pz.push({ nombre: `Lateral cajón ${i+1}`, cant: 2, w: profCajon, h: 200 - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
        pz.push({ nombre: `Frente/fondo cajón ${i+1}`, cant: 2, w: anchoCajonera - 2*e, h: 200 - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
        pz.push({ nombre: `Piso cajón ${i+1}`, cant: 1, w: anchoCajonera - 2*e, h: profCajon - e, esp: eF, veta: null, visible: false, tipo: 'cajon-piso' });
      }
      return pz;
    },
    puertas: (L, H, P, params) => {
      // 3 puertas de ancho igual
      const { gapBorde, gapAlto, gapPuertas } = params;
      const anchoTotal = L - 2*gapBorde - 2*gapPuertas;
      return [{ cant: 3, w: anchoTotal / 3, h: H - 2*gapAlto }];
    },
    cajones: (L, H, P, params) => {
      const arr = [];
      for (let i = 0; i < 3; i++) {
        arr.push({ ancho: 500, alto: 200, profundidad: P - params.descCajonProf });
      }
      return arr;
    },
    accesorios: () => ({}),
    horas: (Lcm) => 9 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: false, zocalo: true, numPatas: 0 },
  },

  'cama': {
    nombre: 'Cama 2 plazas con cabecera',
    ambiente: 'Dormitorio',
    unidad: 'modulo',
    medDefault: { L: 160, H: 120, P: 200 }, // ancho × alto cabecera × largo cama
    piezas: (L, H, P, params) => {
      const { e, eF } = params;
      const pz = [];
      // Marco cama: cabecera, piecera, laterales
      pz.push({ nombre: 'Cabecera', cant: 1, w: L + 40, h: H, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Piecera (pie de cama)', cant: 1, w: L + 40, h: 400, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Lateral largo', cant: 2, w: P, h: 400, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      // Travesaños para sommier
      pz.push({ nombre: 'Travesaño sommier', cant: 5, w: L, h: 80, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Travesaño central longitudinal', cant: 1, w: P, h: 80, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      return pz;
    },
    puertas: () => [],
    cajones: () => [],
    accesorios: () => ({ led: 1.5, fuenteLed: 0.3 }),
    horas: () => 10,
    tieneVidrio: false,
    lleva: { patas: true, zocalo: false, numPatas: 4 },
  },

  'mesa-luz': {
    nombre: 'Mesa de luz',
    ambiente: 'Dormitorio',
    unidad: 'modulo',
    medDefault: { L: 40, H: 50, P: 40 },
    piezas: (L, H, P, params) => {
      const { e, eF, descCajonProf, descLateralCajon } = params;
      const pz = [];
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'estructura' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });
      // Un cajón
      const altoCajon = 150;
      const profCajon = P - descCajonProf;
      pz.push({ nombre: 'Frente cajón', cant: 1, w: L - 2*params.gapBorde, h: altoCajon - 2*params.gapAlto, esp: e, veta: 'V', visible: true, tipo: 'frente' });
      pz.push({ nombre: 'Lateral cajón', cant: 2, w: profCajon, h: altoCajon - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
      pz.push({ nombre: 'Frente/fondo cajón', cant: 2, w: L - 2*e, h: altoCajon - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
      pz.push({ nombre: 'Piso cajón', cant: 1, w: L - 2*e, h: profCajon - e, esp: eF, veta: null, visible: false, tipo: 'cajon-piso' });
      return pz;
    },
    puertas: () => [],
    cajones: (L, H, P, params) => [{ ancho: L, alto: 150, profundidad: P - params.descCajonProf }],
    accesorios: () => ({}),
    horas: () => 3,
    tieneVidrio: false,
    lleva: { patas: true, zocalo: false, numPatas: 4 },
  },

  'escritorio': {
    nombre: 'Escritorio',
    ambiente: 'Dormitorio',
    unidad: 'ml',
    medDefault: { L: 100, H: 75, P: 60 },
    piezas: (L, H, P, params) => {
      const { e, eF, descCajonProf, descLateralCajon } = params;
      const pz = [];
      pz.push({ nombre: 'Tablero superior', cant: 1, w: L, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Costado/pata izq', cant: 1, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Costado/pata der', cant: 1, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Travesaño posterior refuerzo', cant: 1, w: L - 2*e, h: 150, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      // Cajonera colgante (1 cajón)
      const altoCajon = 150;
      const anchoCajonera = 400;
      const profCajon = P - descCajonProf;
      pz.push({ nombre: 'Frente cajón colgante', cant: 1, w: anchoCajonera - 2*params.gapBorde, h: altoCajon - 2*params.gapAlto, esp: e, veta: 'V', visible: true, tipo: 'frente' });
      pz.push({ nombre: 'Lateral cajón colg', cant: 2, w: profCajon, h: altoCajon - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
      pz.push({ nombre: 'Frente/fondo cajón colg', cant: 2, w: anchoCajonera - 2*e, h: altoCajon - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
      pz.push({ nombre: 'Piso cajón colg', cant: 1, w: anchoCajonera - 2*e, h: profCajon - e, esp: eF, veta: null, visible: false, tipo: 'cajon-piso' });
      return pz;
    },
    puertas: () => [],
    cajones: (L, H, P, params) => [{ ancho: 400, alto: 150, profundidad: P - params.descCajonProf }],
    accesorios: () => ({}),
    horas: (Lcm) => 4 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: true, zocalo: false, numPatas: 4 },
  },

  'rack-dorm': {
    nombre: 'Rack TV dormitorio',
    ambiente: 'Dormitorio',
    unidad: 'ml',
    medDefault: { L: 100, H: 50, P: 40 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho } = params;
      const pz = [];
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Estante', cant: 1, w: L - 2*e - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });
      return pz;
    },
    puertas: (L, H, P, params) => calcPuertas(L, H, params),
    cajones: () => [],
    accesorios: () => ({}),
    horas: (Lcm) => 3.5 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: true, zocalo: false, numPatas: 4 },
  },

  'vestidor': {
    nombre: 'Vestidor abierto con cajonera y barral',
    ambiente: 'Dormitorio',
    unidad: 'ml',
    medDefault: { L: 100, H: 240, P: 55 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho, descCajonProf, descLateralCajon } = params;
      const pz = [];
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Estante superior (sombrero)', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Estantes internos', cant: 2, w: L - 2*e - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      // Cajonera (4 cajones de 200mm)
      const anchoCajonera = L - 2*e;
      const profCajon = P - descCajonProf;
      for (let i = 0; i < 4; i++) {
        pz.push({ nombre: `Frente cajón ${i+1}`, cant: 1, w: anchoCajonera - params.gapPuertas, h: 200 - 2*params.gapAlto, esp: e, veta: 'V', visible: true, tipo: 'frente' });
        pz.push({ nombre: `Lateral cajón ${i+1}`, cant: 2, w: profCajon, h: 200 - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
        pz.push({ nombre: `Frente/fondo cajón ${i+1}`, cant: 2, w: anchoCajonera - 2*e, h: 200 - descLateralCajon - 10, esp: e, veta: 'H', visible: false, tipo: 'cajon' });
        pz.push({ nombre: `Piso cajón ${i+1}`, cant: 1, w: anchoCajonera - 2*e, h: profCajon - e, esp: eF, veta: null, visible: false, tipo: 'cajon-piso' });
      }
      return pz;
    },
    puertas: () => [],
    cajones: (L, H, P, params) => {
      const arr = [];
      for (let i = 0; i < 4; i++) {
        arr.push({ ancho: L - 2*params.e, alto: 200, profundidad: P - params.descCajonProf });
      }
      return arr;
    },
    accesorios: () => ({ led: 1.5, fuenteLed: 0.3, sensor: 1 }),
    horas: (Lcm) => 8 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: true, zocalo: true, numPatas: 4 },
  },

  'rack-living': {
    nombre: 'Rack TV living',
    ambiente: 'Living',
    unidad: 'ml',
    medDefault: { L: 100, H: 45, P: 40 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho } = params;
      const pz = [];
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: false, tipo: 'estructura' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Estante', cant: 1, w: L - 2*e - descEstanteAncho, h: P - descEstantePro, esp: e, veta: 'H', visible: false, tipo: 'estante' });
      pz.push({ nombre: 'Fondo', cant: 1, w: L, h: H, esp: eF, veta: null, visible: false, tipo: 'fondo' });
      return pz;
    },
    puertas: (L, H, P, params) => calcPuertas(L, H, params),
    cajones: () => [],
    accesorios: () => ({ led: 1, fuenteLed: 0.2 }),
    horas: (Lcm) => 3.5 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: true, zocalo: false, numPatas: 4 },
  },

  'divisor': {
    nombre: 'Mueble divisor biblioteca',
    ambiente: 'Living',
    unidad: 'ml',
    medDefault: { L: 100, H: 180, P: 35 },
    piezas: (L, H, P, params) => {
      const { e, eF, descEstantePro, descEstanteAncho } = params;
      const pz = [];
      pz.push({ nombre: 'Costado', cant: 2, w: H, h: P, esp: e, veta: 'V', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Piso', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Techo', cant: 1, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      // Sin fondo (divisor es doble cara)
      pz.push({ nombre: 'Estantes', cant: 3, w: L - 2*e, h: P, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      pz.push({ nombre: 'Travesaño inferior', cant: 1, w: L - 2*e, h: 150, esp: e, veta: 'H', visible: true, tipo: 'visible' });
      return pz;
    },
    puertas: (L, H, P, params) => {
      // 1 compartimiento inferior con 2 puertas (cant visible de ambos lados, pero la puerta es 1 física)
      const altoComp = 500;
      return [{ cant: 2, w: (L - 2*params.gapBorde - params.gapPuertas) / 2, h: altoComp - 2*params.gapAlto }];
    },
    cajones: () => [],
    accesorios: () => ({ led: 1.5, fuenteLed: 0.3 }),
    horas: (Lcm) => 5 * (Lcm / 100),
    tieneVidrio: false,
    lleva: { patas: true, zocalo: false, numPatas: 4 },
  },
};

// ============================================================
// FUNCIONES DE CÁLCULO
// ============================================================

function generarDespiece(tipoMueble, medidas, nivel, params) {
  const config = MUEBLES[tipoMueble];
  if (!config) return { piezas: [], puertas: [], cajones: [] };

  const L = medidas.L * 10; // cm → mm
  const H = medidas.H * 10;
  const P = medidas.P * 10;

  const piezas = config.piezas(L, H, P, params);
  const puertas = config.puertas(L, H, P, params);
  const cajones = config.cajones(L, H, P, params);

  // Agregar las puertas como piezas (salvo que sean de vidrio)
  if (!config.tieneVidrio) {
    puertas.forEach((grupo, idx) => {
      piezas.push({
        nombre: grupo.cant === 1 ? 'Puerta' : `Puertas (${grupo.cant})`,
        cant: grupo.cant,
        w: grupo.h,  // puerta alta → w es la altura
        h: grupo.w,
        esp: params.e,
        veta: 'V',
        visible: true,
        tipo: 'puerta',
      });
    });
  }

  return { piezas, puertas, cajones, config };
}

// Optimizador de corte (shelf algorithm simple)
function optimizarCorte(piezas, esp, params) {
  const { placaW, placaH, kerf } = params;
  const items = [];
  let idCounter = 0;

  piezas.filter(p => p.esp === esp).forEach(p => {
    for (let i = 0; i < p.cant; i++) {
      // Rotar para que el alto sea el menor (más eficiente)
      const w = Math.max(p.w, p.h);
      const h = Math.min(p.w, p.h);
      items.push({
        id: idCounter++,
        nombre: p.nombre,
        idx: i + 1,
        w, h,
        veta: p.veta,
        visible: p.visible,
      });
    }
  });

  // Filtrar piezas más grandes que la placa
  const tooLarge = items.filter(it => it.w > placaW || it.h > placaH);
  const valid = items.filter(it => it.w <= placaW && it.h <= placaH);
  valid.sort((a, b) => b.h - a.h);

  const placas = [];

  for (const item of valid) {
    let placed = false;

    for (const placa of placas) {
      // Intentar en una shelf existente
      for (const shelf of placa.shelves) {
        if (item.h <= shelf.h && shelf.x + item.w + (shelf.x > 0 ? kerf : 0) <= placaW) {
          const offset = shelf.x > 0 ? kerf : 0;
          const itemPlaced = { ...item, x: shelf.x + offset, y: shelf.y };
          shelf.x = itemPlaced.x + item.w;
          placa.items.push(itemPlaced);
          placed = true;
          break;
        }
      }
      if (placed) break;

      // Intentar crear nueva shelf
      const lastShelf = placa.shelves[placa.shelves.length - 1];
      const newY = lastShelf.y + lastShelf.h + kerf;
      if (newY + item.h <= placaH) {
        placa.shelves.push({ x: item.w, y: newY, h: item.h });
        placa.items.push({ ...item, x: 0, y: newY });
        placed = true;
      }
      if (placed) break;
    }

    if (!placed) {
      // Nueva placa
      const nuevaPlaca = {
        w: placaW, h: placaH,
        items: [{ ...item, x: 0, y: 0 }],
        shelves: [{ x: item.w, y: 0, h: item.h }],
      };
      placas.push(nuevaPlaca);
    }
  }

  return { placas, tooLarge };
}

function calcularMetros(piezas, esp) {
  let m2 = 0;
  piezas.filter(p => p.esp === esp).forEach(p => {
    m2 += p.cant * (p.w / 1000) * (p.h / 1000);
  });
  return m2;
}

function calcularFilos(piezas, config) {
  // Reglas simplificadas:
  // - Puerta: 4 bordes llevan canto
  // - Costado: 1 borde (frontal)
  // - Piso/techo/estante: 1 borde (frontal)
  // - Travesaño: 1 borde (frontal)
  // - Cajón frente: 4 bordes
  // - Lateral/fondo de cajón: 0 (interno)
  // - Fondo del mueble: 0
  let metros = 0;
  piezas.forEach(p => {
    if (p.esp !== 18) return; // solo MDF
    const peri = 2 * (p.w + p.h); // mm
    let frac = 0;
    if (p.tipo === 'puerta' || p.tipo === 'frente' || p.tipo === 'cajon-frente' || p.tipo === 'visible') {
      frac = 1; // 4 bordes
    } else if (p.tipo === 'estructura' || p.tipo === 'estante') {
      // 1 borde frontal: el borde largo
      frac = Math.max(p.w, p.h) / (p.w + p.h) / 2 * 2; // = max / perimetro/2
      // simplificado: tomar el lado largo / perímetro
      frac = 0.5; // aproximación: un lado largo
    } else {
      frac = 0;
    }
    metros += p.cant * peri * frac / 1000;
  });
  return metros;
}

function calcularCosto(despiece, corte, corte55, nivel, medidas, params, cantidad) {
  const { piezas, config } = despiece;
  const { placas } = corte;

  // m² de placa con margen
  const m2net_18 = calcularMetros(piezas, 18);
  const m2net_55 = calcularMetros(piezas, 5.5);
  const margenDec = params.margenDespLisa / 100;
  const m2_18 = m2net_18 * (1 + margenDec);
  const m2_55 = m2net_55 * (1 + margenDec);

  // m filos con margen
  const m_filoNet = calcularFilos(piezas, config);
  const m_filo = m_filoNet * (1 + margenDec);

  // Piezas visibles (para N5)
  const m2_visibles = piezas
    .filter(p => p.esp === 18 && p.visible)
    .reduce((sum, p) => sum + p.cant * (p.w / 1000) * (p.h / 1000), 0) * (1 + margenDec);

  // Puertas (conteo para herrajes)
  const totalPuertas = despiece.puertas.reduce((sum, g) => sum + g.cant, 0);
  const altoMax = Math.max(...despiece.puertas.map(g => g.h), 0);
  const bisPorPuerta = altoMax > 0 ? bisagrasPorAlto(altoMax) : 0;
  const totalBisagras = totalPuertas * bisPorPuerta;

  const numCajones = despiece.cajones.length;

  // LED
  const acc = config.accesorios(nivel) || {};

  // ============ MATERIALES ============
  const mat = [];

  // Placa principal
  if (nivel === 'N4') {
    mat.push({ concepto: 'MDF 18mm crudo Trupan', unidad: 'm²', cant: m2_18, precio: PRECIOS.crudo, sub: m2_18 * PRECIOS.crudo });
    mat.push({ concepto: 'Laqueado semimate', unidad: 'm²', cant: m2_visibles, precio: PRECIOS.laqueado, sub: m2_visibles * PRECIOS.laqueado });
  } else if (nivel === 'N5') {
    const m2_interna = Math.max(m2_18 - m2_visibles, 0);
    mat.push({ concepto: 'Rauvisio Blanco (piezas visibles)', unidad: 'm²', cant: m2_visibles, precio: PRECIOS.rauvisioBco, sub: m2_visibles * PRECIOS.rauvisioBco });
    if (m2_interna > 0.01) {
      mat.push({ concepto: 'MDF 18mm melamina (estructura interna)', unidad: 'm²', cant: m2_interna, precio: PRECIOS.melamina, sub: m2_interna * PRECIOS.melamina });
    }
  } else {
    mat.push({ concepto: 'MDF 18mm melamina Egger', unidad: 'm²', cant: m2_18, precio: PRECIOS.melamina, sub: m2_18 * PRECIOS.melamina });
  }

  // Fondo
  if (m2_55 > 0.01) {
    mat.push({ concepto: 'Fondo MDF 5.5mm', unidad: 'm²', cant: m2_55, precio: PRECIOS.fondo55, sub: m2_55 * PRECIOS.fondo55 });
  }

  // Filos
  if (nivel === 'N2') {
    mat.push({ concepto: 'Filo ABS 0.8×23mm', unidad: 'm', cant: m_filo, precio: PRECIOS.abs08, sub: m_filo * PRECIOS.abs08 });
  } else if (nivel === 'N3') {
    mat.push({ concepto: 'Filo ABS 2×23mm', unidad: 'm', cant: m_filo, precio: PRECIOS.abs2, sub: m_filo * PRECIOS.abs2 });
  } else if (nivel === 'N5') {
    const filoVis = m_filo * (m2_visibles / Math.max(m2_18, 0.001));
    const filoInt = m_filo - filoVis;
    mat.push({ concepto: 'Filo Rauvisio 1mm (visibles)', unidad: 'm', cant: filoVis, precio: PRECIOS.rauvisio1, sub: filoVis * PRECIOS.rauvisio1 });
    mat.push({ concepto: 'Filo ABS 0.8mm (internos)', unidad: 'm', cant: filoInt, precio: PRECIOS.abs08, sub: filoInt * PRECIOS.abs08 });
  }
  // N4 no lleva filo (el laqueado cubre)

  // Bisagras
  if (totalBisagras > 0) {
    const precioBis = nivel === 'N2' ? PRECIOS.bisN2 : nivel === 'N3' ? PRECIOS.bisN3 : nivel === 'N4' ? PRECIOS.bisN4 : PRECIOS.bisN5;
    mat.push({ concepto: `Bisagras (${bisPorPuerta} por puerta × ${totalPuertas} puertas)`, unidad: 'par', cant: totalBisagras, precio: precioBis, sub: totalBisagras * precioBis });
  }

  // Correderas y laterales de cajón
  if (numCajones > 0) {
    const precioCorr = nivel === 'N2' ? PRECIOS.corrN2 : nivel === 'N3' ? PRECIOS.corrN3 : nivel === 'N4' ? PRECIOS.corrN4 : PRECIOS.corrN5;
    mat.push({ concepto: 'Correderas cajón', unidad: 'par', cant: numCajones, precio: precioCorr, sub: numCajones * precioCorr });
    if (nivel !== 'N2') {
      const precioLat = nivel === 'N3' ? PRECIOS.latN3 : nivel === 'N4' ? PRECIOS.latN4 : PRECIOS.latN5;
      mat.push({ concepto: 'Laterales metálicos cajón', unidad: 'par', cant: numCajones, precio: precioLat, sub: numCajones * precioLat });
    }
  }

  // Patas
  if (config.lleva.patas) {
    const numPatas = config.lleva.numPatas || 4;
    const precioPata = (nivel === 'N4' || nivel === 'N5') ? PRECIOS.pataAl : PRECIOS.pataPVC;
    mat.push({ concepto: `Patas ${(nivel === 'N4' || nivel === 'N5') ? 'aluminio' : 'PVC'}`, unidad: 'u', cant: numPatas, precio: precioPata, sub: numPatas * precioPata });
  }

  // Zócalo
  if (config.lleva.zocalo) {
    const mZoc = medidas.L / 100;
    mat.push({ concepto: 'Zócalo aluminio 100mm', unidad: 'm', cant: mZoc, precio: PRECIOS.zocalo, sub: mZoc * PRECIOS.zocalo });
  }

  // Tiradores
  const numTiradores = totalPuertas + numCajones;
  if (numTiradores > 0) {
    mat.push({ concepto: 'Tiradores', unidad: 'u', cant: numTiradores, precio: PRECIOS.tirador, sub: numTiradores * PRECIOS.tirador });
  }

  // Accesorios cocina (solo N3+)
  if (nivel !== 'N2') {
    if (acc.cubertero) mat.push({ concepto: 'Cubertero PVC 540mm', unidad: 'u', cant: acc.cubertero, precio: PRECIOS.cubertero, sub: acc.cubertero * PRECIOS.cubertero });
    if (acc.pisoBacha) mat.push({ concepto: 'Piso aluminio bajo bacha', unidad: 'u', cant: acc.pisoBacha, precio: PRECIOS.pisoBacha, sub: acc.pisoBacha * PRECIOS.pisoBacha });
    if (acc.tacho) mat.push({ concepto: 'Tacho basura doble (prorrat.)', unidad: 'u', cant: acc.tacho, precio: PRECIOS.tachoDoble, sub: acc.tacho * PRECIOS.tachoDoble });
    if (acc.secaplatos) mat.push({ concepto: 'Secaplatos 800mm', unidad: 'u', cant: acc.secaplatos, precio: PRECIOS.secaplatos, sub: acc.secaplatos * PRECIOS.secaplatos });
  }
  if (nivel === 'N4' || nivel === 'N5') {
    if (acc.magicCorner) mat.push({ concepto: 'Magic Corner', unidad: 'u', cant: acc.magicCorner, precio: PRECIOS.magicCorner, sub: acc.magicCorner * PRECIOS.magicCorner });
  }
  if (nivel === 'N5') {
    if (acc.columnaCS) mat.push({ concepto: 'Columna extraíble CS', unidad: 'u', cant: acc.columnaCS, precio: PRECIOS.columnaCS, sub: acc.columnaCS * PRECIOS.columnaCS });
  }

  // LED (N3+)
  if (nivel !== 'N2' && acc.led) {
    mat.push({ concepto: 'Tira LED COB 12V', unidad: 'm', cant: acc.led, precio: PRECIOS.ledTira, sub: acc.led * PRECIOS.ledTira });
    mat.push({ concepto: 'Perfil aluminio P-1010', unidad: 'm', cant: acc.led, precio: PRECIOS.ledPerfil, sub: acc.led * PRECIOS.ledPerfil });
    if (acc.fuenteLed) mat.push({ concepto: 'Fuente LED 12V 36W (prorrat.)', unidad: 'u', cant: acc.fuenteLed, precio: PRECIOS.ledFuente, sub: acc.fuenteLed * PRECIOS.ledFuente });
  }

  // Vidrio
  if (config.tieneVidrio) {
    const numPuertas = despiece.puertas.reduce((s, g) => s + g.cant, 0);
    mat.push({ concepto: 'Puertas vidrio templado', unidad: 'u', cant: numPuertas, precio: PRECIOS.vidrio, sub: numPuertas * PRECIOS.vidrio });
  }

  // Tornillos
  const tornilloPrecio = config.unidad === 'ml' ? PRECIOS.tornilloKit * (medidas.L / 100) : 1200;
  mat.push({ concepto: 'Kit tornillos + insumos', unidad: 'kit', cant: 1, precio: tornilloPrecio, sub: tornilloPrecio });

  // ============ MANO DE OBRA ============
  const horas = config.horas(medidas.L, medidas.H);
  const costoManoObra = horas * params.horaHombre;

  // ============ TOTALES ============
  const subMateriales = mat.reduce((sum, m) => sum + m.sub, 0);
  const costoDirecto = subMateriales + costoManoObra;
  const precioVenta = costoDirecto * params.margenVenta;

  // Por cantidad
  const totalMateriales = subMateriales * cantidad;
  const totalManoObra = costoManoObra * cantidad;
  const totalDirecto = costoDirecto * cantidad;
  const totalVenta = precioVenta * cantidad;

  return {
    mat,
    m2_18, m2_55, m_filo, m2_visibles,
    horas, costoManoObra,
    subMateriales, costoDirecto, precioVenta,
    totalMateriales, totalManoObra, totalDirecto, totalVenta,
    placas: placas.length,
  };
}

// ============================================================
// COMPONENTES UI
// ============================================================

function Panel({ title, children, action }) {
  return (
    <div className="bg-white border border-stone-300 mb-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-300 bg-stone-50">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 font-serif">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BocetoSVG({ despiece, medidas, config }) {
  if (!config) return null;
  const L = medidas.L * 10;
  const H = medidas.H * 10;
  const P = medidas.P * 10;

  // Escala para SVG (420 px máx por vista)
  const maxW = 420, maxH = 300;
  const scale = Math.min(maxW / L, maxH / H) * 0.85;
  const Ls = L * scale, Hs = H * scale, Ps = P * scale;

  const puertas = despiece.puertas || [];
  const cajones = despiece.cajones || [];

  // Dibujar vista frontal
  const margin = 40;
  const svgW = Ls + 2 * margin + Ps + 80;
  const svgH = Hs + 2 * margin + 60;

  // Layout: vista frontal a la izquierda, vista lateral a la derecha
  const frontX = margin, frontY = margin;

  // Determinar disposición interna
  // Frente con puertas (si tiene) y cajones (si tiene)
  const totalCajones = cajones.length;
  const alturaCajones = cajones.reduce((sum, c) => sum + c.alto, 0) * scale;
  const alturaPuertas = Hs - alturaCajones;

  // Posición de cajones (abajo) y puertas (arriba)
  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto" style={{ maxHeight: 380 }}>
      <defs>
        <pattern id="diag" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#FAFAFA"/>
          <line x1="0" y1="0" x2="0" y2="6" stroke="#E5E5E5" strokeWidth="1"/>
        </pattern>
      </defs>

      {/* ---- VISTA FRONTAL ---- */}
      {/* Caja exterior */}
      <rect x={frontX} y={frontY} width={Ls} height={Hs} fill="#FAFAFA" stroke="#1B2A4A" strokeWidth="1.5"/>

      {/* Área útil interior (descontando costados y techo/piso) */}
      <rect x={frontX + 18*scale} y={frontY + 18*scale} width={Ls - 36*scale} height={Hs - 36*scale} fill="url(#diag)" stroke="none"/>

      {/* Cajones (abajo) */}
      {cajones.length > 0 && (() => {
        let yAcum = frontY + Hs;
        return cajones.map((c, i) => {
          const altoPx = c.alto * scale;
          yAcum -= altoPx;
          return (
            <g key={`caj-${i}`}>
              <rect x={frontX + 2} y={yAcum + 1} width={Ls - 4} height={altoPx - 2}
                fill="#FFEED6" stroke="#D4A843" strokeWidth="1"/>
              <line x1={frontX + Ls/2 - 20} y1={yAcum + altoPx/2} x2={frontX + Ls/2 + 20} y2={yAcum + altoPx/2}
                stroke="#1B2A4A" strokeWidth="1.5"/>
              <text x={frontX + Ls/2} y={yAcum + altoPx/2 + 10} textAnchor="middle" fontSize="9" fill="#1B2A4A"
                fontFamily="monospace">{c.alto}</text>
            </g>
          );
        });
      })()}

      {/* Puertas */}
      {puertas.length > 0 && !config.tieneVidrio && (() => {
        const altoTotalPuertas = alturaPuertas;
        const cantPuertas = puertas[0]?.cant || 1;
        const anchoPuerta = (Ls - 4) / cantPuertas;
        return Array.from({ length: cantPuertas }).map((_, i) => (
          <rect key={`pu-${i}`}
            x={frontX + 2 + i * anchoPuerta}
            y={frontY + 2}
            width={anchoPuerta - 2}
            height={altoTotalPuertas - 4}
            fill="#E8F4D0" stroke="#7B9C3D" strokeWidth="1"/>
        ));
      })()}

      {/* Puertas vidrio (líneas diagonales) */}
      {config.tieneVidrio && puertas.length > 0 && (() => {
        const cantPuertas = puertas[0]?.cant || 1;
        const anchoPuerta = (Ls - 4) / cantPuertas;
        return Array.from({ length: cantPuertas }).map((_, i) => {
          const x = frontX + 2 + i * anchoPuerta;
          const y = frontY + 2;
          const w = anchoPuerta - 2;
          const h = alturaPuertas - 4;
          return (
            <g key={`puv-${i}`}>
              <rect x={x} y={y} width={w} height={h}
                fill="rgba(70, 130, 180, 0.12)" stroke="#4682B4" strokeWidth="1"/>
              <line x1={x} y1={y} x2={x+w} y2={y+h} stroke="#4682B4" strokeWidth="0.5" opacity="0.5"/>
              <line x1={x+w} y1={y} x2={x} y2={y+h} stroke="#4682B4" strokeWidth="0.5" opacity="0.5"/>
            </g>
          );
        });
      })()}

      {/* Cotas frontal */}
      {/* Cota ancho (abajo) */}
      <g fontFamily="monospace" fontSize="10" fill="#666">
        <line x1={frontX} y1={frontY + Hs + 14} x2={frontX + Ls} y2={frontY + Hs + 14} stroke="#999"/>
        <line x1={frontX} y1={frontY + Hs + 10} x2={frontX} y2={frontY + Hs + 18} stroke="#999"/>
        <line x1={frontX + Ls} y1={frontY + Hs + 10} x2={frontX + Ls} y2={frontY + Hs + 18} stroke="#999"/>
        <text x={frontX + Ls/2} y={frontY + Hs + 30} textAnchor="middle">{medidas.L} cm</text>
      </g>
      {/* Cota alto (izquierda) */}
      <g fontFamily="monospace" fontSize="10" fill="#666">
        <line x1={frontX - 14} y1={frontY} x2={frontX - 14} y2={frontY + Hs} stroke="#999"/>
        <line x1={frontX - 18} y1={frontY} x2={frontX - 10} y2={frontY} stroke="#999"/>
        <line x1={frontX - 18} y1={frontY + Hs} x2={frontX - 10} y2={frontY + Hs} stroke="#999"/>
        <text x={frontX - 18} y={frontY + Hs/2} textAnchor="middle"
          transform={`rotate(-90 ${frontX - 18} ${frontY + Hs/2})`}>{medidas.H} cm</text>
      </g>

      {/* ---- VISTA LATERAL ---- */}
      <g transform={`translate(${frontX + Ls + 60}, ${frontY})`}>
        <rect x={0} y={0} width={Ps} height={Hs} fill="#FAFAFA" stroke="#1B2A4A" strokeWidth="1.5"/>
        {/* Cota prof */}
        <g fontFamily="monospace" fontSize="10" fill="#666">
          <line x1={0} y1={Hs + 14} x2={Ps} y2={Hs + 14} stroke="#999"/>
          <text x={Ps/2} y={Hs + 30} textAnchor="middle">{medidas.P} cm</text>
        </g>
        <text x={Ps/2} y={-8} textAnchor="middle" fontSize="9" fill="#888" fontFamily="sans-serif" fontStyle="italic">
          lateral
        </text>
      </g>

      {/* Etiqueta frontal */}
      <text x={frontX + Ls/2} y={frontY - 8} textAnchor="middle" fontSize="9" fill="#888"
        fontFamily="sans-serif" fontStyle="italic">
        frontal
      </text>
    </svg>
  );
}

function PlanoCorteSVG({ placas, params }) {
  if (!placas || placas.length === 0) return <div className="text-sm text-stone-500 italic">Sin piezas de 18mm para cortar.</div>;

  const { placaW, placaH } = params;
  const colores = ['#B3D9FF', '#FFD9B3', '#D4E6B6', '#FFE0B3', '#E8D5F5', '#FFDAB9', '#CCE5FF', '#FFCCCC'];

  return (
    <div className="space-y-4">
      {placas.map((placa, idx) => {
        const maxW = 600;
        const scale = maxW / placaW;
        const svgW = placaW * scale;
        const svgH = placaH * scale;

        return (
          <div key={idx} className="border border-stone-300 bg-stone-50 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-800 mb-2 font-serif">
              Placa {idx + 1} <span className="text-stone-500 font-normal normal-case tracking-normal">(
                {placaW}×{placaH} mm · {placa.items.length} piezas)
              </span>
            </div>
            <svg viewBox={`0 0 ${svgW + 40} ${svgH + 30}`} className="w-full h-auto">
              {/* Placa */}
              <rect x={20} y={10} width={svgW} height={svgH} fill="#FFFFFF" stroke="#1B2A4A" strokeWidth="2"/>
              {placa.items.map((it, i) => {
                const color = colores[i % colores.length];
                const x = 20 + it.x * scale;
                const y = 10 + it.y * scale;
                const w = it.w * scale;
                const h = it.h * scale;
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={w} height={h}
                      fill={color} stroke="#555" strokeWidth="0.5"/>
                    {w > 30 && h > 18 && (
                      <text x={x + w/2} y={y + h/2 + 3} textAnchor="middle"
                        fontSize={Math.min(9, w/8)} fill="#333" fontFamily="monospace">
                        {Math.round(it.w)}×{Math.round(it.h)}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* Cotas placa */}
              <text x={20 + svgW/2} y={svgH + 25} textAnchor="middle" fontSize="9" fill="#666"
                fontFamily="monospace">{placaW} mm</text>
              <text x={10} y={10 + svgH/2} textAnchor="middle" fontSize="9" fill="#666"
                transform={`rotate(-90 10 ${10 + svgH/2})`} fontFamily="monospace">
                {placaH} mm
              </text>
            </svg>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================

export default function App() {
  const [tipoMueble, setTipoMueble] = useState('bajo-cajonera');
  const [medidas, setMedidas] = useState({ L: 100, H: 85, P: 58 });
  const [nivel, setNivel] = useState('N3');
  const [cantidad, setCantidad] = useState(1);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [showParams, setShowParams] = useState(false);
  const [showVeta, setShowVeta] = useState(false);
  const [cotizacionName, setCotizacionName] = useState('');
  const [saved, setSaved] = useState([]);
  const [statusMsg, setStatusMsg] = useState(null);

  // Cargar saved desde storage
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.list('cotizacion:');
        if (r && r.keys) {
          setSaved(r.keys);
        }
      } catch (e) { /* vacío */ }
    })();
  }, []);

  // Actualizar medidas por defecto cuando cambia el tipo
  useEffect(() => {
    const config = MUEBLES[tipoMueble];
    if (config) setMedidas(config.medDefault);
  }, [tipoMueble]);

  const despiece = useMemo(() => generarDespiece(tipoMueble, medidas, nivel, params),
    [tipoMueble, medidas, nivel, params]);

  const margen = showVeta ? params.margenDespVeta : params.margenDespLisa;
  const paramsCorte = { ...params, margenDespLisa: margen };

  const corte = useMemo(() => optimizarCorte(despiece.piezas, 18, paramsCorte),
    [despiece, paramsCorte]);
  const corte55 = useMemo(() => optimizarCorte(despiece.piezas, 5.5, paramsCorte),
    [despiece, paramsCorte]);

  const costo = useMemo(() => calcularCosto(despiece, corte, corte55, nivel, medidas, params, cantidad),
    [despiece, corte, corte55, nivel, medidas, params, cantidad]);

  const fmt = (n) => '$' + Math.round(n).toLocaleString('es-AR');
  const fmtN = (n, d=2) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

  const handleSave = async () => {
    if (!cotizacionName.trim()) { setStatusMsg({ type: 'err', text: 'Ponele un nombre a la cotización antes de guardar.' }); return; }
    try {
      const data = { tipoMueble, medidas, nivel, cantidad, params, fecha: new Date().toISOString() };
      await window.storage.set(`cotizacion:${cotizacionName}`, JSON.stringify(data));
      const r = await window.storage.list('cotizacion:');
      if (r && r.keys) setSaved(r.keys);
      setStatusMsg({ type: 'ok', text: `Guardado: ${cotizacionName}` });
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (e) {
      setStatusMsg({ type: 'err', text: 'Error al guardar: ' + String(e) });
    }
  };

  const handleLoad = async (key) => {
    try {
      const r = await window.storage.get(key);
      if (r && r.value) {
        const data = JSON.parse(r.value);
        setTipoMueble(data.tipoMueble);
        setMedidas(data.medidas);
        setNivel(data.nivel);
        setCantidad(data.cantidad);
        setParams(data.params || DEFAULT_PARAMS);
        setCotizacionName(key.replace('cotizacion:', ''));
        setStatusMsg({ type: 'ok', text: 'Cargado: ' + key.replace('cotizacion:', '') });
        setTimeout(() => setStatusMsg(null), 2500);
      }
    } catch (e) {
      setStatusMsg({ type: 'err', text: 'No se pudo cargar.' });
    }
  };

  const handleDelete = async (key) => {
    if (!confirm(`¿Eliminar "${key.replace('cotizacion:', '')}"?`)) return;
    try {
      await window.storage.delete(key);
      const r = await window.storage.list('cotizacion:');
      setSaved(r && r.keys ? r.keys : []);
    } catch (e) {}
  };

  const tiposPorAmbiente = useMemo(() => {
    const out = {};
    Object.entries(MUEBLES).forEach(([key, m]) => {
      if (!out[m.ambiente]) out[m.ambiente] = [];
      out[m.ambiente].push({ key, nombre: m.nombre });
    });
    return out;
  }, []);

  const nivelColor = { N2: 'bg-slate-800', N3: 'bg-slate-700', N4: 'bg-purple-800', N5: 'bg-orange-700' };

  return (
    <div className="min-h-screen bg-stone-100 text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
      {/* ============ HEADER ============ */}
      <header className="bg-slate-900 text-white border-b-4 border-yellow-600">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
              AUTOMATIZADOR DE MUEBLES A MEDIDA
            </h1>
            <p className="text-xs text-stone-300 mt-1 tracking-widest uppercase" style={{ fontFamily: 'system-ui, sans-serif' }}>
              Despiece · Optimización de corte · Cotización
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowVeta(!showVeta)}
              className={`px-3 py-1.5 text-xs uppercase tracking-wider border transition-colors ${showVeta ? 'bg-yellow-600 border-yellow-600 text-slate-900' : 'border-stone-400 text-stone-300 hover:bg-slate-800'}`}
              style={{ fontFamily: 'system-ui, sans-serif' }}>
              {showVeta ? 'Veta: SÍ' : 'Veta: no'}
            </button>
            <button onClick={() => setShowParams(!showParams)}
              className="px-3 py-1.5 text-xs uppercase tracking-wider border border-stone-400 text-stone-300 hover:bg-slate-800 flex items-center gap-1"
              style={{ fontFamily: 'system-ui, sans-serif' }}>
              <Settings size={14}/> Parámetros
            </button>
          </div>
        </div>
      </header>

      {/* ============ PARÁMETROS (panel colapsable) ============ */}
      {showParams && (
        <div className="bg-slate-50 border-b border-stone-300">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              Parámetros globales del sistema · las 15 respuestas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs" style={{ fontFamily: 'system-ui, sans-serif' }}>
              {[
                ['e', 'Espesor placa (mm)'],
                ['eF', 'Espesor fondo (mm)'],
                ['kerf', 'Kerf sierra (mm)'],
                ['gapPuertas', 'Gap entre puertas (mm)'],
                ['gapBorde', 'Gap puerta-borde (mm)'],
                ['gapAlto', 'Gap puerta-alto (mm)'],
                ['descEstantePro', 'Descuento prof. estante'],
                ['descEstanteAncho', 'Descuento ancho estante'],
                ['margenDespLisa', 'Margen desperdicio (%)'],
                ['margenDespVeta', 'Margen c/veta (%)'],
                ['descCajonProf', 'Descuento prof. cajón'],
                ['descLateralCajon', 'Descuento alto lateral'],
                ['umbralDoblePuerta', 'Umbral 1→2 puertas (mm)'],
                ['horaHombre', 'Hora-hombre ($)'],
                ['margenVenta', 'Margen venta (×)'],
                ['placaW', 'Placa ancho (mm)'],
                ['placaH', 'Placa alto (mm)'],
              ].map(([k, label]) => (
                <div key={k}>
                  <label className="block text-stone-500 text-[10px] uppercase tracking-wide mb-0.5">{label}</label>
                  <input type="number" value={params[k]}
                    onChange={e => setParams({ ...params, [k]: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 border border-stone-300 bg-white text-slate-900 text-sm font-mono"
                    step={k === 'margenVenta' ? 0.01 : 1}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ LAYOUT PRINCIPAL ============ */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Barra de inputs */}
        <div className="bg-white border border-stone-300 mb-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <div className="md:col-span-3">
              <label className="block text-[10px] text-stone-600 uppercase tracking-widest mb-1">Tipo de mueble</label>
              <select value={tipoMueble} onChange={e => setTipoMueble(e.target.value)}
                className="w-full px-3 py-2 border border-stone-400 bg-stone-50 text-sm">
                {Object.entries(tiposPorAmbiente).map(([amb, lista]) => (
                  <optgroup key={amb} label={amb}>
                    {lista.map(m => <option key={m.key} value={m.key}>{m.nombre}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-stone-600 uppercase tracking-widest mb-1">Ancho (cm)</label>
              <input type="number" value={medidas.L} onChange={e => setMedidas({ ...medidas, L: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-stone-400 bg-stone-50 text-sm font-mono"/>
            </div>
            <div>
              <label className="block text-[10px] text-stone-600 uppercase tracking-widest mb-1">Alto (cm)</label>
              <input type="number" value={medidas.H} onChange={e => setMedidas({ ...medidas, H: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-stone-400 bg-stone-50 text-sm font-mono"/>
            </div>
            <div>
              <label className="block text-[10px] text-stone-600 uppercase tracking-widest mb-1">Prof. (cm)</label>
              <input type="number" value={medidas.P} onChange={e => setMedidas({ ...medidas, P: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-stone-400 bg-stone-50 text-sm font-mono"/>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] text-stone-600 uppercase tracking-widest mb-1">Nivel</label>
              <div className="grid grid-cols-4 gap-1">
                {['N2','N3','N4','N5'].map(n => (
                  <button key={n} onClick={() => setNivel(n)}
                    className={`py-2 text-xs font-bold transition-all ${nivel === n ? `${nivelColor[n]} text-white` : 'bg-stone-200 text-stone-600 hover:bg-stone-300'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-stone-600 uppercase tracking-widest mb-1">Cant.</label>
              <input type="number" value={cantidad} min={1}
                onChange={e => setCantidad(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-stone-400 bg-stone-50 text-sm font-mono"/>
            </div>
            <div className="md:col-span-2 flex gap-1">
              <input type="text" placeholder="Nombre..." value={cotizacionName}
                onChange={e => setCotizacionName(e.target.value)}
                className="flex-1 px-2 py-2 border border-stone-400 bg-stone-50 text-sm"/>
              <button onClick={handleSave} title="Guardar"
                className="px-3 py-2 bg-slate-900 text-white hover:bg-slate-700">
                <Save size={14}/>
              </button>
            </div>
          </div>

          {/* Status message */}
          {statusMsg && (
            <div className={`mt-3 text-xs py-1 px-3 inline-flex items-center gap-2 ${statusMsg.type === 'ok' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`} style={{ fontFamily: 'system-ui, sans-serif' }}>
              {statusMsg.type === 'ok' ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>} {statusMsg.text}
            </div>
          )}

          {/* Saved list */}
          {saved.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <span className="text-[10px] text-stone-500 uppercase tracking-widest self-center mr-1">Guardadas:</span>
              {saved.slice(0, 10).map(k => (
                <span key={k} className="text-xs bg-stone-100 border border-stone-300 flex items-center">
                  <button onClick={() => handleLoad(k)} className="px-2 py-1 hover:bg-stone-200 flex items-center gap-1">
                    <FolderOpen size={10}/> {k.replace('cotizacion:', '')}
                  </button>
                  <button onClick={() => handleDelete(k)} className="px-1.5 py-1 hover:bg-red-50 text-red-700 border-l border-stone-300">
                    <Trash2 size={10}/>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ============ BOCETO + RESUMEN ============ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2">
            <Panel title="Boceto técnico">
              <BocetoSVG despiece={despiece} medidas={medidas} config={despiece.config}/>
            </Panel>
          </div>
          <div>
            <Panel title="Resumen">
              <dl className="space-y-2 text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                <div className="flex justify-between border-b border-stone-200 py-1">
                  <dt className="text-stone-600">Piezas totales</dt>
                  <dd className="font-mono font-bold">{despiece.piezas.reduce((s,p)=>s+p.cant,0)}</dd>
                </div>
                <div className="flex justify-between border-b border-stone-200 py-1">
                  <dt className="text-stone-600">m² placa 18mm (+{margen}%)</dt>
                  <dd className="font-mono font-bold">{fmtN(costo.m2_18)}</dd>
                </div>
                <div className="flex justify-between border-b border-stone-200 py-1">
                  <dt className="text-stone-600">m² fondo 5,5mm</dt>
                  <dd className="font-mono font-bold">{fmtN(costo.m2_55)}</dd>
                </div>
                <div className="flex justify-between border-b border-stone-200 py-1">
                  <dt className="text-stone-600">m filos (+{margen}%)</dt>
                  <dd className="font-mono font-bold">{fmtN(costo.m_filo)}</dd>
                </div>
                <div className="flex justify-between border-b border-stone-200 py-1">
                  <dt className="text-stone-600">Placas 18mm necesarias</dt>
                  <dd className="font-mono font-bold text-yellow-800">{corte.placas.length}</dd>
                </div>
                <div className="flex justify-between border-b border-stone-200 py-1">
                  <dt className="text-stone-600">Horas de mano de obra</dt>
                  <dd className="font-mono font-bold">{fmtN(costo.horas, 1)} h</dd>
                </div>
                <div className="flex justify-between py-1 mt-2 bg-yellow-50 px-2 border-l-4 border-yellow-600">
                  <dt className="font-bold text-slate-900">Precio venta × {cantidad}</dt>
                  <dd className="font-mono font-bold text-lg text-slate-900">{fmt(costo.totalVenta)}</dd>
                </div>
              </dl>

              {/* Alertas */}
              {corte.tooLarge.length > 0 && (
                <div className="mt-3 p-2 bg-red-50 border-l-4 border-red-700 text-xs" style={{ fontFamily: 'system-ui, sans-serif' }}>
                  <div className="font-bold text-red-900 flex items-center gap-1">
                    <AlertCircle size={12}/> Hay piezas más grandes que la placa
                  </div>
                  <div className="text-red-800 mt-1">
                    {corte.tooLarge.map((it, i) => (
                      <div key={i}>• {it.nombre}: {Math.round(it.w)}×{Math.round(it.h)} mm</div>
                    ))}
                    <div className="mt-1 italic">Agregá divisor interno o partí en 2 módulos.</div>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* ============ DESPIECE ============ */}
        <Panel title={`Despiece · ${despiece.piezas.length} tipos de pieza (${despiece.piezas.reduce((s,p)=>s+p.cant,0)} unidades totales)`}>
          <div className="overflow-x-auto" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Pieza</th>
                  <th className="px-3 py-2 text-center">Cant.</th>
                  <th className="px-3 py-2 text-right">Ancho (mm)</th>
                  <th className="px-3 py-2 text-right">Alto (mm)</th>
                  <th className="px-3 py-2 text-right">Espesor</th>
                  <th className="px-3 py-2 text-center">Veta</th>
                  <th className="px-3 py-2 text-center">Visible</th>
                  <th className="px-3 py-2 text-right">Total m²</th>
                </tr>
              </thead>
              <tbody>
                {despiece.piezas.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-stone-50' : 'bg-white'}>
                    <td className="px-3 py-1.5">{p.nombre}</td>
                    <td className="px-3 py-1.5 text-center font-mono">{p.cant}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{Math.round(p.w)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{Math.round(p.h)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{p.esp}</td>
                    <td className="px-3 py-1.5 text-center font-mono text-stone-500">
                      {p.veta === 'V' ? '↕' : p.veta === 'H' ? '↔' : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {p.visible ? <Eye size={14} className="inline text-yellow-700"/> : <EyeOff size={14} className="inline text-stone-300"/>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {fmtN(p.cant * (p.w / 1000) * (p.h / 1000), 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ============ PLANO DE CORTE ============ */}
        <Panel title={`Plano de corte · placa MDF 18mm · ${corte.placas.length} placa${corte.placas.length !== 1 ? 's' : ''}`}>
          <PlanoCorteSVG placas={corte.placas} params={params}/>
        </Panel>

        {/* ============ COTIZACIÓN ============ */}
        <Panel title="Cotización desglosada">
          <div className="overflow-x-auto" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Concepto</th>
                  <th className="px-3 py-2 text-center">Unidad</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Precio unit.</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {costo.mat.map((m, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-stone-50' : 'bg-white'}>
                    <td className="px-3 py-1.5">{m.concepto}</td>
                    <td className="px-3 py-1.5 text-center text-stone-500">{m.unidad}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtN(m.cant, 2)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmt(m.precio)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(m.sub)}</td>
                  </tr>
                ))}
                <tr className="bg-stone-100 border-t-2 border-slate-900">
                  <td colSpan={4} className="px-3 py-2 font-bold text-right">Subtotal materiales (1 unidad)</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{fmt(costo.subMateriales)}</td>
                </tr>
                <tr className="bg-stone-50">
                  <td className="px-3 py-1.5">Mano de obra</td>
                  <td className="px-3 py-1.5 text-center text-stone-500">h</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtN(costo.horas, 1)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmt(params.horaHombre)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(costo.costoManoObra)}</td>
                </tr>
                <tr className="bg-stone-100 border-t-2 border-slate-900">
                  <td colSpan={4} className="px-3 py-2 font-bold text-right">Costo directo (materiales + m.o.) · 1 unidad</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{fmt(costo.costoDirecto)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-1.5 text-right text-stone-600">
                    Margen ×{params.margenVenta}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {fmt(costo.precioVenta - costo.costoDirecto)}
                  </td>
                </tr>
                <tr className="bg-yellow-50 border-t-2 border-yellow-700">
                  <td colSpan={4} className="px-3 py-2 font-bold text-right">Precio venta · 1 unidad</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-lg">{fmt(costo.precioVenta)}</td>
                </tr>
                <tr className="bg-slate-900 text-white">
                  <td colSpan={4} className="px-3 py-3 font-bold text-right">
                    PRECIO FINAL × {cantidad} unidad{cantidad > 1 ? 'es' : ''}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-xl">{fmt(costo.totalVenta)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-stone-500 italic" style={{ fontFamily: 'system-ui, sans-serif' }}>
            <AlertCircle size={12} className="inline mr-1"/>
            Sin IVA · sin mesada/bacha · sin electrodomésticos · sin instalación en obra · sin transporte.
            Todos los m² ya incluyen margen de desperdicio de +{margen}%.
          </div>
        </Panel>

        {/* ============ FOOTER ============ */}
        <div className="text-center text-xs text-stone-500 py-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="tracking-widest uppercase">Prototipo v1 · valores típicos de industria</div>
          <div className="mt-1 italic">Ajustá los 15 parámetros globales cuando el carpintero te dé los valores reales.</div>
        </div>
      </main>
    </div>
  );
}
