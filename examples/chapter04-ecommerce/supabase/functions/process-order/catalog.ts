import catalogJson from "./catalog.json" with { type: "json" };

export interface CatalogProduct {
  product_id: number;
  name: string;
  unit_price_yen: number;
}

export const LOCAL_PRODUCT_CATALOG: readonly Readonly<CatalogProduct>[] = Object
  .freeze(
    catalogJson.map((product) => Object.freeze({ ...product })),
  );

const productById = new Map(
  LOCAL_PRODUCT_CATALOG.map((product) => [product.product_id, product]),
);

export function findLocalProduct(
  productId: number,
): Readonly<CatalogProduct> | undefined {
  return productById.get(productId);
}
