import { createHash } from 'node:crypto'

export function contentHash(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

export function sourceHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}
