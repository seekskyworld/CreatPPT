/** JSON snapshot used by undo/redo and drag transactions. */
export function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
