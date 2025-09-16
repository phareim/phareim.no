declare module '@fal-ai/client';
declare module 'h3';
declare module 'markdown-it';

declare module 'fs' {
  export function readFileSync(path: string, options?: any): string | Buffer
  export function readdirSync(path: string): string[]
  export function existsSync(path: string): boolean
}

declare module 'path' {
  export function join(...paths: string[]): string
}

declare const process: {
  cwd(): string
}

declare module '#imports' {
  // Minimal typings for Nuxt composables we use in type checking
  // eslint-disable-next-line @typescript-eslint/ban-types
  export function useRuntimeConfig(): any
}