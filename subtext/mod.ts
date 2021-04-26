import { MISSING, KeyMap, newWeakMap } from "./_keyMap.ts";

export interface Key<T> {
  merge?: (left: T, right: T) => T;
}

const { freeze } = Object;
let subtextCount = 0;

export class Subtext {
  private parents: Subtext[];

  // Maintain a global ordering of Subtext objects by creation time,
  // so we can avoid checking a.isAncestorOf(b) if a.tick > b.tick.
  public readonly tick = ++subtextCount;

  public constructor(...parents: Subtext[]) {
    freeze(this.parents = parents);
    freeze(this);
  }

  public has<T>(key: Key<T>): boolean {
    return this.find(key) !== MISSING;
  }

  public get<T>(key: Key<T>): T | undefined {
    const value = this.find(key);
    if (value !== MISSING) return value;
  }

  private find<T>(key: Key<T>): T | (typeof MISSING) {
    const map = KeyMap.for(this);
    if (!map.has(key)) {
      const values: T[] = [];
      this.parents.forEach(parent => {
        const value = parent.find(key);
        if (value !== MISSING && values.indexOf(value) < 0) {
          values.push(value);
        }
      });
      map.set(
        key,
        values.length
          // If this key defines a merge function, use it to resolve any merge
          // conflicts. Otherwise, always prefer the last (right-most) value.
          ? key.merge ? values.reduce(key.merge) : values.pop()!
          : MISSING,
      );
    }
    return map.get(key);
  }

  // We could potentially allow Subtext.prototype.run to be monkey-patched
  // for tracking purposes, since it is not sensitive (does not take a Key).
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

  public branch(...keyValues: [Key<any>, any][]): Subtext {
    if (!keyValues.length) return this;
    const branch = new Subtext(this);
    const map = KeyMap.for(branch);
    for (let i = 0; i < keyValues.length; ++i) {
      const [key, value] = keyValues[i];
      map.set(key, value);
    }
    return branch;
  }

  public limit(...keys: Key<any>[]): Subtext {
    const result = new Subtext;
    if (keys.length) {
      const map = KeyMap.for(result);
      keys.forEach(key => map.set(key, this.get(key)));
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
    const workSet = new Set([that]);
    for (const subtext of workSet) {
      if (subtext === this) return true;
      subtext.parents.forEach(workSet.add, workSet);
    }
    return false;
  }

  static get current() {
    return current;
  }
}

// Deno's TypeScript compiler complains if Subtext extends null, throwing
// "ReferenceError: Must call super constructor in derived class before
// accessing 'this' or returning from derived constructor" even though calling
// super() in the constructor is forbidden for classes that extend null.
// Fortunately, we can achieve the same effect by changing Subtext.prototype's
// own prototype to null here, then freeze it to prevent further modification.
// Thanks to this Object.setPrototypeOf trick, it's as if Subtext.prototype was
// created using Object.create(null), so it won't be vulnerable to inheriting
// properties added to Object.prototype, like a "normal" {} object would.
Object.setPrototypeOf(Subtext.prototype, null);
freeze(Subtext.prototype);

// While most ECMAScript live bindings remain relatively unchanged after their
// first initialization, this live binding really deserves to be called "live,"
// since it changes every time a function gets called by the subtext.run method.
export let current = new Subtext;
