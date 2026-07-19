import { findLocalProduct } from "./catalog.ts";

export const MAX_ORDER_ITEMS = 20;
export const MAX_QUANTITY = 99;

export interface PreparedOrderItem {
  product_id: number;
  name: string;
  quantity: number;
  unit_price_yen: number;
  line_total_yen: number;
}

export interface PreparedOrder {
  items: PreparedOrderItem[];
  total_amount_yen: number;
}

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

const allowedItemFields = new Set(["product_id", "quantity"]);
const allowedOrderFields = new Set(["items"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    throw new OrderValidationError(
      `${field} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value as number;
}

export function prepareOrder(input: unknown): PreparedOrder {
  if (!isRecord(input) || !Array.isArray(input.items)) {
    throw new OrderValidationError("items must be an array");
  }
  if (Object.hasOwn(input, "unit_price_yen")) {
    throw new OrderValidationError(
      "unit_price_yen is forbidden; prices are server-owned",
    );
  }
  const unsupportedOrderFields = Object.keys(input).filter(
    (field) => !allowedOrderFields.has(field),
  );
  if (unsupportedOrderFields.length > 0) {
    throw new OrderValidationError(
      `request contains unsupported fields: ${
        unsupportedOrderFields.join(", ")
      }`,
    );
  }
  if (input.items.length === 0 || input.items.length > MAX_ORDER_ITEMS) {
    throw new OrderValidationError(
      `items must contain between 1 and ${MAX_ORDER_ITEMS} entries`,
    );
  }

  const productIds = new Set<number>();
  const items = input.items.map((item, index): PreparedOrderItem => {
    if (!isRecord(item)) {
      throw new OrderValidationError(`items[${index}] must be an object`);
    }
    if (Object.hasOwn(item, "unit_price_yen")) {
      throw new OrderValidationError(
        `items[${index}].unit_price_yen is forbidden; prices are server-owned`,
      );
    }
    const unsupportedFields = Object.keys(item).filter(
      (field) => !allowedItemFields.has(field),
    );
    if (unsupportedFields.length > 0) {
      throw new OrderValidationError(
        `items[${index}] contains unsupported fields: ${
          unsupportedFields.join(", ")
        }`,
      );
    }

    const productId = requiredInteger(
      item.product_id,
      `items[${index}].product_id`,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    if (productIds.has(productId)) {
      throw new OrderValidationError(`product_id ${productId} is duplicated`);
    }
    productIds.add(productId);

    const product = findLocalProduct(productId);
    if (!product) {
      throw new OrderValidationError(`unknown product_id ${productId}`);
    }

    const quantity = requiredInteger(
      item.quantity,
      `items[${index}].quantity`,
      1,
      MAX_QUANTITY,
    );

    return {
      product_id: productId,
      name: product.name,
      quantity,
      unit_price_yen: product.unit_price_yen,
      line_total_yen: quantity * product.unit_price_yen,
    };
  });

  return {
    items,
    total_amount_yen: items.reduce(
      (total, item) => total + item.line_total_yen,
      0,
    ),
  };
}
