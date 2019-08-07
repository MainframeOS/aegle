export function fromBuffer<T = any>(buffer: Buffer): T {
  return JSON.parse(buffer.toString())
}

export function toBuffer<T = any>(data: T): Buffer {
  return Buffer.from(JSON.stringify(data))
}
