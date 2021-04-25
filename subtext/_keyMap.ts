import { Subtext, Key } from "./mod.ts";

export const MISSING: unique symbol = Symbol();

const { assign } = Object;

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

const keyMapsBySubtext = newWeakMap<Subtext, KeyMap>();

export class KeyMap extends null {
  private weak = newWeakMap<Key<any>, any>();

  static for(subtext: Subtext): KeyMap {
    let map = keyMapsBySubtext.get(subtext);
    if (!map) keyMapsBySubtext.set(subtext, map = new KeyMap);
    return map;
  }

  has<T>(key: Key<T>): boolean {
    return this.weak.has(key);
  }

  get<T>(key: Key<T>): T | (typeof MISSING) {
    return this.weak.has(key) ? this.weak.get(key) : MISSING;
  }

  set<T>(key: Key<T>, value: T | (typeof MISSING)) {
    this.weak.set(key, value);
    return this;
  }
}
