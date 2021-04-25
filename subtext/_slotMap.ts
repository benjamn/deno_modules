import { Subtext, Slot } from "./mod.ts";

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

const slotMapsBySubtext = newWeakMap<Subtext, SlotMap>();

export class SlotMap extends null {
  private weak = newWeakMap<Slot<any>, any>();

  static for(subtext: Subtext): SlotMap {
    let map = slotMapsBySubtext.get(subtext);
    if (!map) slotMapsBySubtext.set(subtext, map = new SlotMap);
    return map;
  }

  has<T>(slot: Slot<T>): boolean {
    return this.weak.has(slot);
  }

  get<T>(slot: Slot<T>): T | typeof MISSING {
    return this.weak.has(slot) ? this.weak.get(slot) : MISSING;
  }

  set<T>(slot: Slot<T>, value: T | typeof MISSING) {
    this.weak.set(slot, value);
    return this;
  }
}
