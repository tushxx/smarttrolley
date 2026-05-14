import type { CartItemWithProduct, CartWithItems } from "@shared/schema";

/** Grams: treat measured weight below this as "not weighed yet". */
export const GRAM_PENDING_THRESHOLD_G = 3;

/** Unexplained scale reading above this triggers an error (no matching scan). */
export const WEIGHT_ERROR_THRESHOLD_G = 40;

/** Minimum delta before we trust a reading for auto-assigning weight to a pending line item. */
export const WEIGHT_ASSIGN_MIN_G = 25;

export function lineItemSubtotal(item: CartItemWithProduct): number {
  if (item.product.unit === "grams" && item.product.weight && item.measuredWeight) {
    const basePrice = parseFloat(item.product.price);
    const baseWeightG = parseFloat(String(item.product.weight));
    const measuredG = parseFloat(String(item.measuredWeight));
    if (baseWeightG > 0 && measuredG > 0) {
      return (basePrice / baseWeightG) * measuredG;
    }
    return 0;
  }
  return parseFloat(item.product.price) * item.quantity;
}

export function cartSubtotal(items: CartItemWithProduct[]): number {
  return items.reduce((s, i) => s + lineItemSubtotal(i), 0);
}

/**
 * Total weight (grams) the cart says should currently be on the scale.
 * "grams" SKUs count measuredWeight only; "each" uses product.weight * qty if set.
 */
export function expectedCartWeightG(cart: CartWithItems | undefined): number {
  if (!cart?.items?.length) return 0;
  return cart.items.reduce((sum, item) => {
    if (item.product.unit === "grams") {
      const m = item.measuredWeight ? parseFloat(String(item.measuredWeight)) : 0;
      return sum + (Number.isFinite(m) ? m : 0);
    }
    const nominal = item.product.weight ? parseFloat(String(item.product.weight)) : 0;
    return sum + nominal * item.quantity;
  }, 0);
}

/** Most recently added cart line that still needs a scale reading (grams SKU). */
export function lastPendingGramItem(
  cart: CartWithItems | undefined,
): CartItemWithProduct | undefined {
  if (!cart?.items?.length) return undefined;
  return [...cart.items]
    .reverse()
    .find(
      (i) =>
        i.product.unit === "grams" &&
        (!i.measuredWeight || parseFloat(String(i.measuredWeight)) < GRAM_PENDING_THRESHOLD_G),
    );
}

export function hasUnweighedGramProduct(cart: CartWithItems | undefined): boolean {
  return lastPendingGramItem(cart) !== undefined;
}
