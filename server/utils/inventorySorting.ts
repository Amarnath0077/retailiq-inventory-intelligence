import type { Product } from '../../src/types/inventory.ts';

export type AlphabeticalSortType = 'Alphabetical (A-Z)' | 'Alphabetical (Z-A)';

/**
 * Enterprise Inventory Sorting Utility
 * Supports 'Alphabetical (A-Z)' and 'Alphabetical (Z-A)' parameters,
 * as well as multi-key field sorting with secondary tie-breakers.
 */
export function applyInventorySorting(
  items: Product[],
  sortParam?: string,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'asc'
): Product[] {
  const sorted = [...items];
  const normalizedParam = (sortParam || '').trim().toLowerCase();

  // 1. Explicit 'Alphabetical (A-Z)' sorting parameter
  if (
    normalizedParam === 'alphabetical (a-z)' ||
    normalizedParam === 'alpha_asc' ||
    normalizedParam === 'a-z' ||
    (sortBy === 'alphabetical' && sortOrder === 'asc') ||
    (sortBy === 'brand' && sortOrder === 'asc' && !sortParam)
  ) {
    return sorted.sort((a, b) => {
      // Primary: Brand A -> Z
      const brandComp = a.brand.localeCompare(b.brand);
      if (brandComp !== 0) return brandComp;
      // Secondary: Color A -> Z
      const colorComp = a.color.localeCompare(b.color);
      if (colorComp !== 0) return colorComp;
      // Tertiary: Size
      return a.size.localeCompare(b.size);
    });
  }

  // 2. Explicit 'Alphabetical (Z-A)' sorting parameter
  if (
    normalizedParam === 'alphabetical (z-a)' ||
    normalizedParam === 'alpha_desc' ||
    normalizedParam === 'z-a' ||
    (sortBy === 'alphabetical' && sortOrder === 'desc') ||
    (sortBy === 'brand' && sortOrder === 'desc' && !sortParam)
  ) {
    return sorted.sort((a, b) => {
      // Primary: Brand Z -> A
      const brandComp = b.brand.localeCompare(a.brand);
      if (brandComp !== 0) return brandComp;
      // Secondary: Color A -> Z
      const colorComp = a.color.localeCompare(b.color);
      if (colorComp !== 0) return colorComp;
      // Tertiary: Size
      return a.size.localeCompare(b.size);
    });
  }

  // 3. Preset shortcut values
  if (normalizedParam === 'price_asc') {
    return sorted.sort((a, b) => a.price - b.price);
  }
  if (normalizedParam === 'price_desc') {
    return sorted.sort((a, b) => b.price - a.price);
  }
  if (normalizedParam === 'stock_desc') {
    return sorted.sort((a, b) => b.stock_quantity - a.stock_quantity);
  }
  if (normalizedParam === 'stock_asc') {
    return sorted.sort((a, b) => a.stock_quantity - b.stock_quantity);
  }
  if (normalizedParam === 'value_desc') {
    return sorted.sort((a, b) => b.inventory_value - a.inventory_value);
  }

  // 4. Fallback to sortBy and sortOrder parameters
  const field = sortBy || 't_shirt_id';
  const multiplier = sortOrder === 'desc' ? -1 : 1;

  return sorted.sort((a, b) => {
    const valA = (a as any)[field];
    const valB = (b as any)[field];
    if (typeof valA === 'string' && typeof valB === 'string') {
      return valA.localeCompare(valB) * multiplier;
    }
    return ((Number(valA) || 0) - (Number(valB) || 0)) * multiplier;
  });
}
