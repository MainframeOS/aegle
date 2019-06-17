import { Transform, TransformCallback } from 'stream'

export function fromBuffer(buffer: Buffer): any {
  return JSON.parse(buffer.toString())
}

export function toBuffer(data: any): Buffer {
  return Buffer.from(JSON.stringify(data))
}

export class CheckMaxSize extends Transform {
  private checkedSize: number
  private maxSize: number

  public constructor(maxSize: number) {
    super()
    this.checkedSize = 0
    this.maxSize = maxSize
  }

  public _transform(chunk: any, encoding: string, callback: TransformCallback) {
    this.checkedSize += chunk.length
    if (this.checkedSize > this.maxSize) {
      callback(new Error('Maximum size exceeded'))
    } else {
      callback(undefined, chunk)
    }
  }
}
