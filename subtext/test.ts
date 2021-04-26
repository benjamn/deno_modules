import {
  assertEquals,
  assertStrictEquals,
  assertNotStrictEquals,
} from "https://deno.land/std@0.93.0/testing/asserts.ts";

import { Subtext, Key, current } from "./mod.ts";

Deno.test("Subtext and subtext", function () {
  assertEquals(current instanceof Subtext, true);
  assertStrictEquals(current, Subtext.current);
});

Deno.test("live binding of current export", function () {
  const key: Key<number> = {};
  const before = current;
  const branch = before.branch([key, 123]);

  assertNotStrictEquals(branch, current);
  assertStrictEquals(before.has(key), false);
  assertStrictEquals(branch.has(key), true);
  assertStrictEquals(branch.get(key), 123);

  const innerResult = branch.run(() => {
    assertStrictEquals(current, branch);
    assertNotStrictEquals(current, before);
    assertStrictEquals(current.get(key), 123);
    return current.branch([key, 234]).run(() => {
      assertNotStrictEquals(current, branch);
      assertNotStrictEquals(current, before);
      return current.get(key)!;
    });
  });

  assertStrictEquals(innerResult, 234);
  assertStrictEquals(current, before);
  assertNotStrictEquals(current, branch);
  assertStrictEquals(current.has(key), false);
});
