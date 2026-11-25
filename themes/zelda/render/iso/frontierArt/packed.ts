import { gunzipSync } from 'fflate'

/** Decode a losslessly packed generated sprite table. The editable poses live alongside it. */
export function unpackArt<T>(base64: string): T {
  const packed = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(gunzipSync(packed))) as T
}
