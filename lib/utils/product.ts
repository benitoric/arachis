/**
 * Returns the display name for a product: "Sabor (Xg)"
 * Falls back to just the name if presentation is 0 or missing.
 */
export function pName(product: {
  name: string;
  presentation?: number | null;
}): string {
  return product.presentation
    ? `${product.name} (${product.presentation}g)`
    : product.name;
}
