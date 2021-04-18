import {
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.93.0/testing/asserts.ts";

import { Subtext, subtext } from "./mod.ts";

Deno.test("Subtext and subtext", function () {
  assertEquals(subtext instanceof Subtext, true);
  assertStrictEquals(subtext, Subtext.current);
});
