import { KeyMap } from "./_keyMap.ts";
import { MISSING, newWeakMap, setPrototypeOf } from "./_helpers.ts";

// Any object reference can serve as a Key<T>, unlocking access to private
// Subtext-tracked values of type T. A merge method may optionally be defined to
// handle any merge conflicts upon attempting to read the conflicted value.
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

  // In case you need/want to run a function in a restricted context containing
  // only a known subset of keys (for example, because those keys are ones your
  // caching system is aware of, and you don't want the function depending on
  // any other untracked contextual information). Calling subtext.limit()
  // returns a completely empty Subtext.
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

    // If one context is an ancestor of the other, the descendant can be
    // returned as-is, without creating a new Subtext. This behavior is similar
    // to a fast-forward merge in Git.
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

  private ancestorCache = newWeakMap<Subtext, boolean>();
  private isAncestorOf(that: Subtext): boolean {
    if (this === that) return true;

    const cached = that.ancestorCache.get(this);
    if (typeof cached === "boolean") {
      return cached;
    }

    const workSet = new Set([that]);
    for (const subtext of workSet) {
      that.ancestorCache.set(subtext, true);

      if (subtext === this ||
          subtext.ancestorCache.has(this)) {
        return true;
      }

      subtext.parents.forEach(workSet.add, workSet);
    }

    that.ancestorCache.set(this, false);
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
setPrototypeOf(Subtext.prototype, null);
freeze(Subtext.prototype);

// While most ECMAScript live bindings remain relatively unchanged after their
// first initialization, this live binding really deserves to be called "live,"
// since it changes every time a function gets called by the subtext.run method.
export let current = new Subtext;
