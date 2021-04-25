import { MISSING, SlotMap, newWeakMap } from './_slotMap.ts';

export interface Slot<T> {
  key?: any; // TODO
  merge?: (left: T, right: T) => T;
}

const { freeze } = Object;
let subtextCount = 0;

export class Subtext extends null {
  private parents: Subtext[];

  // Maintain a global ordering of Subtext objects by creation time,
  // so we can avoid checking a.isAncestorOf(b) if a.tick > b.tick.
  public readonly tick = ++subtextCount;

  public constructor(...parents: Subtext[]) {
    freeze(this.parents = parents);
    freeze(this);
  }

  public has<T>(slot: Slot<T>): boolean {
    return this.find(slot) !== MISSING;
  }

  public get<T>(slot: Slot<T>): T | undefined {
    const value = this.find(slot);
    if (value !== MISSING) return value;
  }

  private find<T>(slot: Slot<T>): T | typeof MISSING {
    const map = SlotMap.for(this);
    if (!map.has(slot)) {
      const values: T[] = [];
      this.parents.forEach(parent => {
        const value = parent.find(slot);
        if (value !== MISSING && values.indexOf(value) < 0) {
          values.push(value);
        }
      });
      map.set(
        slot,
        values.length
          ? slot.merge ? values.reduce(slot.merge) : values.pop()!
          : MISSING,
      );
    }
    return map.get(slot);
  }

  // We could potentially allow Subtext.prototype.run to be monkey-patched
  // for tracking purposes, since it is not sensitive (does not take a Slot).
  public run<TSelf, TArgs extends any[], TResult>(
    fn: (this: TSelf, ...args: TArgs) => TResult,
    args?: TArgs | IArguments,
    self?: TSelf,
  ): TResult {
    const saved = current;
    try {
      current = this;
      return fn.apply(self as TSelf, args as TArgs);
    } finally {
      current = saved;
    }
  }

  public bind<TThis, TArgs extends any[], TResult>(
    fn: (this: TThis, ...args: TArgs) => TResult,
  ) {
    const bound = this;
    return function (this: TThis) {
      return bound.merge(current).run(fn, arguments, this);
    } as typeof fn;
  }

  public branch(...slotValues: [Slot<any>, any][]): Subtext {
    if (!slotValues.length) return this;
    const branch = new Subtext(this);
    const map = SlotMap.for(branch);
    for (let i = 0; i < slotValues.length; ++i) {
      const [slot, value] = slotValues[i];
      map.set(slot, value);
    }
    return branch;
  }

  public limit(...slots: Slot<any>[]): Subtext {
    const result = new Subtext;
    if (slots.length) {
      const map = SlotMap.for(result);
      slots.forEach(slot => map.set(slot, this.get(slot)));
    }
    return result;
  }

  private mergeCache = newWeakMap<Subtext, Subtext>();
  public merge(that: Subtext): Subtext {
    if (this === that) return that;

    let merged = this.mergeCache.get(that);
    if (merged) return merged;

    // If one context is an ancestor of the other, the descendant
    // can be returned without creating a new Subtext.
    if (this.tick < that.tick) {
      if (this.isAncestorOf(that)) {
        merged = that;
      }
    } else if (that.isAncestorOf(this)) {
      merged = this;
    }

    this.mergeCache.set(
      that,
      merged = merged || new Subtext(this, that),
    );

    return merged;
  }

  private isAncestorOf(that: Subtext): boolean {
    for (let i = 0, workQueue = [that]; i < workQueue.length; ++i) {
      const subtext = workQueue[i];
      if (subtext === this) return true;
      workQueue.push.apply(workQueue, subtext.parents);
    }
    return false;
  }

  static get current() {
    return current;
  }
}

freeze(Subtext.prototype);

// This live binding changes every time a new function is run by
// Subtext.prototype.run
export let current = new Subtext;
