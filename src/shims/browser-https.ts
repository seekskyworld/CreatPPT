export function get(): never {
  throw new Error('Node HTTPS requests are unavailable in browser PPTX exports.')
}

export default { get }
