import {
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.93.0/testing/asserts.ts";

import { Subtext, current } from "./mod.ts";

Deno.test("Subtext and subtext", function () {
  assertEquals(current instanceof Subtext, true);
  assertStrictEquals(current, Subtext.current);
});
