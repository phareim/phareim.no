/**
 * The polygon view's camera rig. Pure: no canvas, no DOM.
 *
 * A world point is (x east, y south, z up), all in tiles, as in `iso/camera.ts`.
 *
 * The rig is an interpolation between poses, and the classic picture is one
 * of them. That is what makes the turn: `rigMatrix(0, …)` is the classic
 * oblique picture to the pixel (so the hand-off can lie on it), `rigMatrix(1,
 * …)` is the pose, and in between the camera tips down off the classic
 * picture and the lines begin to meet. Two perspective poses are eased into
 * each other with `mixPose` (the crane sinking to the shoulder between the
 * 32-bit and the 64-bit look), which `turn.ts` knows nothing of: the view
 * does that itself when its values change.
 *
 * A pose aims the camera at the focus (the point the rig follows, normally
 * the hero's feet lifted to the ground's height) from `dist` tiles away,
 * heading `yaw` and looking down by `pitch`, and then slides the picture so
 * that the focus lands `focusY` of the way down the screen (a lens shift: the
 * picture is moved, the camera is not tilted, so what stands upright stays
 * upright on the screen).
 */
import type { Vec2 } from '../iso/project'

/** Column-major 4 × 4, as WebGL wants it: world (tiles) → clip. */
export type Mat4 = number[]

export interface Pose {
  /** Heading, radians: 0 looks north (toward −y), a quarter turn (π/2) looks east. The controls turn by it (`View.turn`). */
  yaw: number
  /** How far below level the camera looks, radians (π/2 would be straight down). */
  pitch: number
  /** Eye to focus, tiles. */
  dist: number
  /** Vertical field of view, radians, on a landscape screen; on a screen taller than wide it is the horizontal one, so a phone sees no less to the sides. */
  fov: number
  /** Where the focus lands, 0 (top of the screen) … 1 (bottom). */
  focusY: number
}

/** The 32-bit look's camera: a crane behind and above the hero, looking north, the horizon in the top eighth. */
export const CRANE: Pose = { yaw: 0, pitch: 25 * Math.PI / 180, dist: 10.5, fov: 50 * Math.PI / 180, focusY: 0.62 }

/** The 64-bit look's camera: at the hero's shoulder, the horizon across the upper half. Its yaw follows the hero. */
export const SHOULDER: Pose = { yaw: 0, pitch: 14 * Math.PI / 180, dist: 4.2, fov: 60 * Math.PI / 180, focusY: 0.66 }

/**
 * A pose `t` of the way from `a` to `b` (0 … 1, not eased here). The yaw goes
 * the short way round; the distance is mixed in the log, so a pull-back and
 * a push-in look alike.
 */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  void a; void b; void t
  throw new Error('poly/camera.mixPose: not built')
}

/**
 * The classic picture as a matrix: world point (x, y, z) lands on scene px
 * (x·TILE − cx, (y − z)·TILE − cy) of a scene vw × vh px, where (cx, cy) is
 * the classic camera's top-left corner in px (`Picture.cx`, `Picture.cy`).
 * Height runs straight up the screen, unforeshortened, as the classic art
 * assumes. Depth sorts the way the classic painters do: of two points on the
 * same px, the one further south (and so higher up) is in front.
 */
export function classicMatrix(vw: number, vh: number, cx: number, cy: number): Mat4 {
  void vw; void vh; void cx; void cy
  throw new Error('poly/camera.classicMatrix: not built')
}

/** A pose as a matrix, for a scene vw × vh px, following `focus` (tiles). `near` and `far` in tiles from the eye. */
export function poseMatrix(pose: Pose, vw: number, vh: number, focus: { x: number; y: number; z: number }, near?: number, far?: number): Mat4 {
  void pose; void vw; void vh; void focus; void near; void far
  throw new Error('poly/camera.poseMatrix: not built')
}

/**
 * The matrix `k` of the way through the turn (raw k, 0 … 1; eased inside):
 * exactly `classic` at 0, exactly `posed` at 1, and between them a picture
 * in which every point that both ends show moves without a jump and stays in
 * front of the camera.
 */
export function rigMatrix(k: number, classic: Mat4, posed: Mat4): Mat4 {
  void k; void classic; void posed
  throw new Error('poly/camera.rigMatrix: not built')
}

/**
 * A world point on the scene: px from the scene's top-left, `depth` 0 (at
 * the near plane) … 1 (far), smaller in front, and `w` (positive in front of
 * the camera; a billboard's size on the screen goes by 1 / w).
 */
export function toScreen(m: Mat4, vw: number, vh: number, x: number, y: number, z = 0): Vec2 & { depth: number; w: number } {
  void m; void vw; void vh; void x; void y; void z
  throw new Error('poly/camera.toScreen: not built')
}

/**
 * The ground point (at height z, tiles) under a scene px, or null where the
 * px looks over the horizon. The inverse of `toScreen` on that plane.
 */
export function toGround(m: Mat4, vw: number, vh: number, sx: number, sy: number, z = 0): Vec2 | null {
  void m; void vw; void vh; void sx; void sy; void z
  throw new Error('poly/camera.toGround: not built')
}

/** Where the horizon crosses the middle of the scene, px from the top (negative: above the screen; Infinity: the camera sees none, as in the classic picture). */
export function horizonY(m: Mat4, vw: number, vh: number): number {
  void m; void vw; void vh
  throw new Error('poly/camera.horizonY: not built')
}
