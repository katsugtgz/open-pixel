// Deno test for verify-wallet-proof Edge Function.
// Run: `deno test --allow-env --allow-net supabase/functions/verify-wallet-proof/index.test.ts`
//
// These tests stub the global `Deno.serve` so the handler can be invoked
// directly without binding a socket. All cases exercise the negative path
// (every verification failure returns HTTP 401). The 200 success path
// requires a real ECDSA signature and is not covered here; the fake fetch
// stub for /rest/v1/wallet_proofs exists so the handler can be imported
// without network errors but is never reached by these tests.

import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// The function module calls Deno.serve at import time. Capture the
// handler so tests can call it directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedHandler: ((req: Request) => Promise<Response>) | undefined;

const originalServe = Deno.serve;
// @ts-expect-error overriding for capture
Deno.serve = (optsOrHandler: unknown, maybeHandler?: unknown) => {
  const handler =
    typeof optsOrHandler === "function"
      ? optsOrHandler
      : (maybeHandler as (req: Request) => Promise<Response>);
  capturedHandler = handler;
  return { finished: Promise.resolve() } as Deno.HttpServer;
};

// Stub env: the handler only reads these on the success path, but
// pre-populating avoids runtime errors during the recover step.
Deno.env.set("SUPABASE_URL", "https://fake.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-service-key");

// Replace global fetch so the supabase-js client's insert resolves OK
// without a real network call.
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: URL | RequestInfo | string) => {
  const url = typeof input === "string" ? input : input.toString();
  if (url.includes("/rest/v1/wallet_proofs")) {
    return new Response(JSON.stringify([]), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response("{}", { status: 200 });
}) as typeof globalThis.fetch;

await import("./index.ts");

Deno.serve = originalServe;
globalThis.fetch = originalFetch;

const handler = (req: Request): Promise<Response> => {
  if (!capturedHandler) {
    throw new Error("Deno.serve handler was not captured");
  }
  return capturedHandler(req);
};

function post(body: unknown): Promise<Response> {
  return handler(
    new Request("https://example.test/functions/v/verify-wallet-proof", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

Deno.test("rejects malformed JSON body with 401", async () => {
  const response = await handler(
    new Request("https://example.test/functions/v/verify-wallet-proof", {
      method: "POST",
      body: "not-json",
    }),
  );
  assertEquals(response.status, 401);
});

Deno.test("rejects missing fields with 401", async () => {
  const response = await post({ quest_run_id: "run_1" });
  assertEquals(response.status, 401);
  const body = await response.json();
  assertEquals(body.verified, false);
});

Deno.test("rejects non-hex signature with 401", async () => {
  const response = await post({
    quest_run_id: "run_1",
    wallet_address: "0x" + "0".repeat(40),
    message: "Open Pixel Proof",
    signature: "nothex",
  });
  assertEquals(response.status, 401);
  const body = await response.json();
  assert(String(body.error).includes("signature"));
});

Deno.test("rejects invalid wallet address format with 401", async () => {
  const response = await post({
    quest_run_id: "run_1",
    wallet_address: "0xdeadbeef",
    message: "Open Pixel Proof",
    signature: "0xabc",
  });
  assertEquals(response.status, 401);
});

Deno.test("rejects GET with 405", async () => {
  const response = await handler(
    new Request("https://example.test/functions/v/verify-wallet-proof", {
      method: "GET",
    }),
  );
  assertEquals(response.status, 405);
});

Deno.test("OPTIONS returns 200 with CORS headers", async () => {
  const response = await handler(
    new Request("https://example.test/functions/v/verify-wallet-proof", {
      method: "OPTIONS",
    }),
  );
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
});

// A real ECDSA-forged signature will fail recoverAddress — we cannot
// construct a valid one in a unit test without a signing key, so we
// assert the failure mode is 401 (the security-critical property).
Deno.test("rejects signature that does not recover with 401", async () => {
  const forgedSig = "0x" + "11".repeat(32) + "22".repeat(32) + "01";
  const response = await post({
    quest_run_id: "run_1",
    wallet_address: "0x" + "ab".repeat(20),
    message: "Open Pixel Proof\n\nDomain: example.test",
    signature: forgedSig,
  });
  assertEquals(response.status, 401);
  const body = await response.json();
  assertEquals(body.verified, false);
  // Either recovery failed or the (essentially random) recovered
  // address did not match — both are valid 401 outcomes.
  assertNotEquals(body.error, undefined);
});
