declare module '@fal-ai/client';
declare module 'h3';
declare module 'markdown-it';

// Cloudflare D1 types
interface D1Result<T = unknown> {
    results: T[]
    success: boolean
    error?: string
    meta?: object
}

interface D1ExecResult {
    count: number
    duration: number
}

interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement
    first<T = unknown>(colName?: string): Promise<T | null>
    run<T = unknown>(): Promise<D1Result<T>>
    all<T = unknown>(): Promise<D1Result<T>>
    raw<T = unknown[]>(): Promise<T[]>
}

interface D1Database {
    prepare(query: string): D1PreparedStatement
    exec(query: string): Promise<D1ExecResult>
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
    dump(): Promise<ArrayBuffer>
}

// Cloudflare R2 types
interface R2PutOptions {
    httpMetadata?: { contentType?: string; contentEncoding?: string; [key: string]: string | undefined }
    customMetadata?: Record<string, string>
}

interface R2Object {
    key: string
    size: number
    etag: string
    httpEtag: string
    checksums: object
    uploaded: Date
    httpMetadata?: object
    customMetadata?: Record<string, string>
}

interface R2ObjectBody extends R2Object {
    body: ReadableStream
    bodyUsed: boolean
    arrayBuffer(): Promise<ArrayBuffer>
    text(): Promise<string>
    json<T>(): Promise<T>
    blob(): Promise<Blob>
}

interface R2Bucket {
    put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>
    get(key: string): Promise<R2ObjectBody | null>
    delete(keys: string | string[]): Promise<void>
    head(key: string): Promise<R2Object | null>
    list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ objects: R2Object[]; truncated: boolean; cursor?: string }>
}

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