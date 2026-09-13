import { describe, expect, test } from "vitest";

import { errorMessage } from "./api-client";

/**
 * FastAPI returns two different error shapes and only one of them is a string.
 * Every caller used to render `body.detail` directly, so a Pydantic validation
 * error -- an array of objects -- went into React state and took the page down
 * with "Objects are not valid as a React child". On checkout. At payment.
 *
 * The array below is copied verbatim from the live API:
 *   POST https://api.savvyinteal.com/api/auth/register {"email":"not-an-email"}
 */

const response = (status: number, body: unknown): Response =>
  ({ status, json: async () => body }) as unknown as Response;

const PYDANTIC_422 = [
  {
    type: "value_error",
    loc: ["body", "email"],
    msg: "value is not a valid email address: An email address must have an @-sign.",
    input: "not-an-email",
  },
];

describe("errorMessage", () => {
  test("a handler-raised detail is shown as written", async () => {
    const message = await errorMessage(
      response(422, { detail: "We don't recognise that PIN code." }),
      "fallback",
    );

    expect(message).toBe("We don't recognise that PIN code.");
  });

  test("a Pydantic error becomes a string, never an object", async () => {
    /** The crash. Anything other than a string here reaches React as a child. */
    const message = await errorMessage(response(422, { detail: PYDANTIC_422 }), "fallback");

    expect(typeof message).toBe("string");
    expect(message).toContain("@-sign");
  });

  test("a Pydantic error names the field the shopper can see", async () => {
    const message = await errorMessage(response(422, { detail: PYDANTIC_422 }), "fallback");

    expect(message).toMatch(/^email: /);
  });

  test("a nested field reports its own name, not the body", async () => {
    /** shipping_address.postcode must read as "postcode", because "body" names
     * nothing the shopper can look at. */
    const message = await errorMessage(
      response(422, {
        detail: [{ loc: ["body", "shipping_address", "postcode"], msg: "must be 6 digits" }],
      }),
      "fallback",
    );

    expect(message).toBe("postcode: must be 6 digits");
  });

  test("an unreachable server says so rather than falling back", async () => {
    expect(await errorMessage(null, "fallback")).toContain("Couldn't reach the server");
  });

  test.each([
    ["401", 401],
    ["403", 403],
  ])("%s reports an expired session, not the raw body", async (_label, status) => {
    expect(await errorMessage(response(status, { detail: "Not authenticated" }), "fb")).toContain(
      "session has expired",
    );
  });

  test.each([
    ["an empty array", []],
    ["an array of junk", [1, "two", null]],
    ["an object", { nope: true }],
    ["null", null],
    ["absent", {}],
  ])("%s falls back rather than rendering itself", async (_label, detail) => {
    const body = detail === null ? null : { detail };
    expect(await errorMessage(response(422, body), "fallback")).toBe("fallback");
  });

  test("a body that is not JSON at all falls back", async () => {
    const broken = {
      status: 500,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    } as unknown as Response;

    expect(await errorMessage(broken, "fallback")).toBe("fallback");
  });
});
