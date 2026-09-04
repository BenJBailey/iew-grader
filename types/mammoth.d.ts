/**
 * mammoth ships no TypeScript types. Only the one call this app makes is
 * declared, rather than pulling in a fuller third-party definition.
 */
declare module 'mammoth' {
  type ExtractResult = {
    value: string
    messages: Array<{ type: string; message: string }>
  }

  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>
  }

  export default mammoth
}
