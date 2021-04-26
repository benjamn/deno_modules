import { Subtext, Key } from "./mod.ts";
import { MISSING, newWeakMap, setPrototypeOf, freeze } from "./_helpers.ts";

const keyMapsBySubtext = newWeakMap<Subtext, KeyMap>();

export class KeyMap {
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
// Simulate `class KeyMap extends null` to work around spurious TypeError.
// See my similar comment for setPrototypeOf(Subtext.prototype, null).
setPrototypeOf(KeyMap.prototype, null);
freeze(KeyMap.prototype);
