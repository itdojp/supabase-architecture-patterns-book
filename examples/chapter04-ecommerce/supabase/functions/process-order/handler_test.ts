import { handleRequest } from "./handler.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`expected ${expectedJson}, received ${actualJson}`);
  }
}

function postRequest(body: string): Request {
  return new Request("http://local.test/process-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

async function responseJson(response: Response): Promise<unknown> {
  return await response.json();
}

Deno.test("POST uses the authoritative catalog and returns no CORS header", async () => {
  const response = await handleRequest(
    postRequest(JSON.stringify({ items: [{ product_id: 1, quantity: 2 }] })),
  );

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("access-control-allow-origin"), null);
  assertEquals(await responseJson(response), {
    status: "validated",
    items: [
      {
        product_id: 1,
        name: "から揚げ弁当",
        quantity: 2,
        unit_price_yen: 580,
        line_total_yen: 1160,
      },
    ],
    total_amount_yen: 1160,
    persistence: "not_performed",
  });
});

Deno.test("POST rejects client unit_price_yen tampering", async () => {
  const response = await handleRequest(
    postRequest(
      JSON.stringify({
        items: [{ product_id: 1, quantity: 1, unit_price_yen: 1 }],
      }),
    ),
  );

  assertEquals(response.status, 422);
  assertEquals(await responseJson(response), {
    error: "invalid_order",
    message: "items[0].unit_price_yen is forbidden; prices are server-owned",
  });
});

Deno.test("POST rejects invalid JSON", async () => {
  const response = await handleRequest(postRequest("{"));

  assertEquals(response.status, 400);
  assertEquals(await responseJson(response), { error: "invalid_json" });
});

Deno.test("non-POST methods are rejected without OPTIONS or CORS handling", async () => {
  for (const method of ["GET", "OPTIONS"]) {
    const response = await handleRequest(
      new Request("http://local.test/process-order", { method }),
    );

    assertEquals(response.status, 405);
    assertEquals(response.headers.get("allow"), "POST");
    assertEquals(response.headers.get("access-control-allow-origin"), null);
    assertEquals(await responseJson(response), { error: "method_not_allowed" });
  }
});

Deno.test("POST rejects an unknown product", async () => {
  const response = await handleRequest(
    postRequest(JSON.stringify({ items: [{ product_id: 999, quantity: 1 }] })),
  );

  assertEquals(response.status, 422);
  assertEquals(await responseJson(response), {
    error: "invalid_order",
    message: "unknown product_id 999",
  });
});
