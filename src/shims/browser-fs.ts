export function readFileSync(): never {
  throw new Error('Filesystem paths are unavailable in browser PPTX exports.')
}

export default { readFileSync }
