export const MISSING: unique symbol = Symbol();

export const {
  assign,
  freeze,
  setPrototypeOf,
} = Object;

const safeWeakMapMethods = {
  has: WeakMap.prototype.has,
  get: WeakMap.prototype.get,
  set: WeakMap.prototype.set,
};

export function newWeakMap<Key extends object, Value>():
  Pick<WeakMap<Key, Value>, "has" | "get" | "set">
{
  return assign(new WeakMap, safeWeakMapMethods);
}
