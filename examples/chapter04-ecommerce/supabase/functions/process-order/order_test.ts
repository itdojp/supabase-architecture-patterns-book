import { OrderValidationError, prepareOrder } from "./order.ts";
import { LOCAL_PRODUCT_CATALOG } from "./catalog.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`expected ${expectedJson}, received ${actualJson}`);
  }
}

function assertValidationError(callback: () => unknown, message: string): void {
  try {
    callback();
  } catch (error) {
    if (
      error instanceof OrderValidationError && error.message.includes(message)
    ) {
      return;
    }
    throw error;
  }
  throw new Error("expected OrderValidationError");
}

Deno.test("prepareOrder calculates line totals and the server-side total", () => {
  const result = prepareOrder({
    items: [
      { product_id: 1, quantity: 2 },
      { product_id: 3, quantity: 1 },
    ],
  });

  assertEquals(result, {
    items: [
      {
        product_id: 1,
        name: "から揚げ弁当",
        quantity: 2,
        unit_price_yen: 580,
        line_total_yen: 1160,
      },
      {
        product_id: 3,
        name: "サラダボウル",
        quantity: 1,
        unit_price_yen: 450,
        line_total_yen: 450,
      },
    ],
    total_amount_yen: 1610,
  });
});

Deno.test("local catalog exposes the server-owned product identity and price", () => {
  assertEquals(LOCAL_PRODUCT_CATALOG, [
    { product_id: 1, name: "から揚げ弁当", unit_price_yen: 580 },
    { product_id: 2, name: "ハンバーグ弁当", unit_price_yen: 680 },
    { product_id: 3, name: "サラダボウル", unit_price_yen: 450 },
    { product_id: 4, name: "チキンカレー", unit_price_yen: 750 },
  ]);
});

Deno.test("prepareOrder rejects an empty order", () => {
  assertValidationError(() => prepareOrder({ items: [] }), "between 1 and 20");
});

Deno.test("prepareOrder rejects an invalid quantity", () => {
  assertValidationError(
    () =>
      prepareOrder({
        items: [{ product_id: 1, quantity: 0 }],
      }),
    "quantity must be an integer between 1 and 99",
  );
});

Deno.test("prepareOrder rejects duplicate product IDs", () => {
  assertValidationError(
    () =>
      prepareOrder({
        items: [
          { product_id: 1, quantity: 1 },
          { product_id: 1, quantity: 2 },
        ],
      }),
    "product_id 1 is duplicated",
  );
});

Deno.test("prepareOrder rejects client-supplied unit_price_yen even when correct", () => {
  assertValidationError(
    () =>
      prepareOrder({
        items: [{ product_id: 1, quantity: 1, unit_price_yen: 580 }],
      }),
    "unit_price_yen is forbidden; prices are server-owned",
  );
});

Deno.test("prepareOrder rejects a top-level client price field", () => {
  assertValidationError(
    () =>
      prepareOrder({
        items: [{ product_id: 1, quantity: 1 }],
        unit_price_yen: 1,
      }),
    "unit_price_yen is forbidden; prices are server-owned",
  );
});

Deno.test("prepareOrder rejects an unknown product", () => {
  assertValidationError(
    () => prepareOrder({ items: [{ product_id: 999, quantity: 1 }] }),
    "unknown product_id 999",
  );
});
