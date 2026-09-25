/**
 * The cast's builds and colours: body proportions in room pixels (feet at
 * y = 0, up is negative) and four-tone materials, deep → highlight.
 */
import type { Mat } from './doll'

export type RigId = 'kjell' | 'dag' | 'espen' | 'professor'

export interface Look {
  id: RigId
  /** Hip joint height above the floor = thigh + shin. */
  legLen: number
  legR: number
  /** Half the distance between the leg centres, front view. */
  legGap: number
  /** Hip → shoulder line. */
  torsoH: number
  /** Front half-widths of the torso at the bottom, the belly (0.6 down from the top) and the top. */
  hipW: number
  bellyW: number
  chestW: number
  /** Side view: the torso's half-depth as a share of the front width. */
  depth: number
  /** Side view: how far the belly sticks out forward (px). */
  paunch: number
  shoulderX: number
  armLen: number
  armR: number
  handR: number
  /** Head centre above the shoulder line. */
  neck: number
  headRx: number
  headRy: number
  suit: Mat
  skin: Mat
  shoe: Mat
  /** Hands in the suit's paws (mittens) or bare. */
  hand: Mat
}

// Outline and a few shared inks.
export const INK = {
  k: '#0b0616',
  frame: '#1c1030',
  lens: '#d8f0ff',
  glint: '#ffffff',
  eye: '#1c1030',
  white: '#fbf8ff',
  mouth: '#5a1830',
  tongue: '#e0607a',
  tooth: '#fff4ff',
  blush: '#ff9cb4',
  sweat: '#8fe8ff',
}

export const MAT = {
  suitK: ['#6c6296', '#a79ecd', '#dcd6f2', '#fbf9ff'] as Mat,
  suitD: ['#716381', '#aa9cb8', '#ded5e2', '#fbf6f6'] as Mat,
  suitE: ['#5f659a', '#9ba2d2', '#d4daf3', '#f7f9ff'] as Mat,
  skinK: ['#8e5060', '#cf8a7c', '#f2b99b', '#ffdac4'] as Mat,
  skinD: ['#8a4448', '#c87464', '#eba386', '#ffc8a6'] as Mat,
  skinE: ['#955a70', '#d8998c', '#f8c9b0', '#ffe4d2'] as Mat,
  skinP: ['#8a5670', '#c98f8a', '#eebca6', '#ffdcca'] as Mat,
  pink: ['#a8467a', '#dc6c9c', '#ff9cc4', '#ffc6de'] as Mat,
  ginger: ['#5e2818', '#9a4a26', '#cf7636', '#f2a656'] as Mat,
  darkHair: ['#120a1e', '#271a3a', '#3f2c58', '#624a84'] as Mat,
  blond: ['#86652a', '#c29638', '#ecc65e', '#fff09c'] as Mat,
  whiteHair: ['#77769a', '#b9b8d2', '#e8e8f4', '#ffffff'] as Mat,
  shoeK: ['#16142a', '#2a2c4c', '#464a76', '#6c729e'] as Mat,
  shoeD: ['#241208', '#44261a', '#6a3e26', '#91603a'] as Mat,
  shoeE: ['#2a1250', '#54259e', '#9a4ff0', '#c9a8ff'] as Mat,
  shoeP: ['#12081e', '#2a1030', '#4a1c3a', '#74324e'] as Mat,
  teeK: ['#0e4656', '#18889e', '#2cc4d6', '#8fe8ff'] as Mat,
  teeD: ['#743410', '#c0621a', '#fa963c', '#ffc46c'] as Mat,
  coat: ['#56627a', '#97a6ba', '#dbe5ee', '#ffffff'] as Mat,
  trousers: ['#170c28', '#281c46', '#3c2c62', '#5a4a88'] as Mat,
  emf: ['#6e420c', '#c0801a', '#ffd23f', '#fff2b0'] as Mat,
  battery: ['#07040d', '#16141f', '#262433', '#3f3c55'] as Mat,
  red: ['#6a0c22', '#a8163a', '#ff3b5c', '#ff8aa0'] as Mat,
  gold: ['#6a4208', '#b27a14', '#ffd23f', '#fff1b0'] as Mat,
  jar: ['#4a0c1c', '#8e1830', '#d0304c', '#ff7a8c'] as Mat,
  steel: ['#3a3a54', '#6c6c8c', '#a8a8c8', '#e8e8ff'] as Mat,
}

export const LOOKS: Record<RigId, Look> = {
  kjell: {
    id: 'kjell',
    legLen: 19, legR: 1.9, legGap: 2.5,
    torsoH: 12, hipW: 5, bellyW: 4.7, chestW: 4.6, depth: 0.78, paunch: 0,
    shoulderX: 4.6, armLen: 13, armR: 1.55, handR: 1.8,
    neck: 9.5, headRx: 8, headRy: 8.6,
    suit: MAT.suitK, skin: MAT.skinK, shoe: MAT.shoeK, hand: MAT.skinK,
  },
  dag: {
    id: 'dag',
    legLen: 12, legR: 3.3, legGap: 4.6,
    torsoH: 19, hipW: 10.5, bellyW: 12.5, chestW: 9, depth: 0.8, paunch: 4,
    shoulderX: 8.2, armLen: 13, armR: 2.6, handR: 2.5,
    neck: 7, headRx: 8.2, headRy: 7.8,
    suit: MAT.suitD, skin: MAT.skinD, shoe: MAT.shoeD, hand: MAT.skinD,
  },
  espen: {
    id: 'espen',
    legLen: 10, legR: 1.75, legGap: 2.3,
    torsoH: 10, hipW: 4.6, bellyW: 4.2, chestW: 4.4, depth: 0.8, paunch: 0,
    shoulderX: 4.1, armLen: 10, armR: 1.45, handR: 1.7,
    neck: 8.3, headRx: 8.2, headRy: 8,
    suit: MAT.suitE, skin: MAT.skinE, shoe: MAT.shoeE, hand: MAT.skinE,
  },
  professor: {
    id: 'professor',
    legLen: 16, legR: 1.7, legGap: 2.3,
    torsoH: 13, hipW: 5.2, bellyW: 4.8, chestW: 4.9, depth: 0.72, paunch: 0,
    shoulderX: 4.8, armLen: 13, armR: 1.6, handR: 1.6,
    neck: 8, headRx: 6.8, headRy: 7.4,
    suit: MAT.coat, skin: MAT.skinP, shoe: MAT.shoeP, hand: MAT.skinP,
  },
}
