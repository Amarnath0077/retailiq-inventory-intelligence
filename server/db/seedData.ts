export interface RawTShirt {
  t_shirt_id: number;
  brand: 'Nike' | 'Levi' | 'Van Heusen' | 'Adidas';
  color: 'White' | 'Black' | 'Red' | 'Blue';
  size: 'XS' | 'S' | 'M' | 'L' | 'XL';
  price: number;
  stock_quantity: number;
}

export interface RawDiscount {
  t_shirt_id: number;
  pct_discount: number;
}

// Canonical AtliQ T-Shirts Dataset
export const INITIAL_T_SHIRTS: RawTShirt[] = [
  { t_shirt_id: 1, brand: 'Nike', color: 'White', size: 'XS', price: 25, stock_quantity: 42 },
  { t_shirt_id: 2, brand: 'Nike', color: 'White', size: 'S', price: 28, stock_quantity: 18 },
  { t_shirt_id: 3, brand: 'Nike', color: 'White', size: 'M', price: 30, stock_quantity: 65 },
  { t_shirt_id: 4, brand: 'Nike', color: 'White', size: 'L', price: 32, stock_quantity: 12 },
  { t_shirt_id: 5, brand: 'Nike', color: 'White', size: 'XL', price: 35, stock_quantity: 9 },

  { t_shirt_id: 6, brand: 'Nike', color: 'Black', size: 'XS', price: 25, stock_quantity: 34 },
  { t_shirt_id: 7, brand: 'Nike', color: 'Black', size: 'S', price: 28, stock_quantity: 51 },
  { t_shirt_id: 8, brand: 'Nike', color: 'Black', size: 'M', price: 30, stock_quantity: 80 },
  { t_shirt_id: 9, brand: 'Nike', color: 'Black', size: 'L', price: 32, stock_quantity: 40 },
  { t_shirt_id: 10, brand: 'Nike', color: 'Black', size: 'XL', price: 35, stock_quantity: 14 },

  { t_shirt_id: 11, brand: 'Nike', color: 'Red', size: 'XS', price: 24, stock_quantity: 7 },
  { t_shirt_id: 12, brand: 'Nike', color: 'Red', size: 'S', price: 27, stock_quantity: 22 },
  { t_shirt_id: 13, brand: 'Nike', color: 'Red', size: 'M', price: 29, stock_quantity: 35 },
  { t_shirt_id: 14, brand: 'Nike', color: 'Red', size: 'L', price: 31, stock_quantity: 11 },
  { t_shirt_id: 15, brand: 'Nike', color: 'Red', size: 'XL', price: 33, stock_quantity: 5 },

  { t_shirt_id: 16, brand: 'Nike', color: 'Blue', size: 'XS', price: 26, stock_quantity: 19 },
  { t_shirt_id: 17, brand: 'Nike', color: 'Blue', size: 'S', price: 29, stock_quantity: 48 },
  { t_shirt_id: 18, brand: 'Nike', color: 'Blue', size: 'M', price: 31, stock_quantity: 72 },
  { t_shirt_id: 19, brand: 'Nike', color: 'Blue', size: 'L', price: 33, stock_quantity: 26 },
  { t_shirt_id: 20, brand: 'Nike', color: 'Blue', size: 'XL', price: 36, stock_quantity: 8 },

  { t_shirt_id: 21, brand: 'Levi', color: 'White', size: 'XS', price: 32, stock_quantity: 24 },
  { t_shirt_id: 22, brand: 'Levi', color: 'White', size: 'S', price: 35, stock_quantity: 39 },
  { t_shirt_id: 23, brand: 'Levi', color: 'White', size: 'M', price: 38, stock_quantity: 55 },
  { t_shirt_id: 24, brand: 'Levi', color: 'White', size: 'L', price: 40, stock_quantity: 28 },
  { t_shirt_id: 25, brand: 'Levi', color: 'White', size: 'XL', price: 44, stock_quantity: 13 },

  { t_shirt_id: 26, brand: 'Levi', color: 'Black', size: 'XS', price: 34, stock_quantity: 15 },
  { t_shirt_id: 27, brand: 'Levi', color: 'Black', size: 'S', price: 37, stock_quantity: 44 },
  { t_shirt_id: 28, brand: 'Levi', color: 'Black', size: 'M', price: 40, stock_quantity: 68 },
  { t_shirt_id: 29, brand: 'Levi', color: 'Black', size: 'L', price: 42, stock_quantity: 32 },
  { t_shirt_id: 30, brand: 'Levi', color: 'Black', size: 'XL', price: 45, stock_quantity: 6 },

  { t_shirt_id: 31, brand: 'Levi', color: 'Red', size: 'XS', price: 30, stock_quantity: 11 },
  { t_shirt_id: 32, brand: 'Levi', color: 'Red', size: 'S', price: 33, stock_quantity: 19 },
  { t_shirt_id: 33, brand: 'Levi', color: 'Red', size: 'M', price: 36, stock_quantity: 27 },
  { t_shirt_id: 34, brand: 'Levi', color: 'Red', size: 'L', price: 39, stock_quantity: 10 },
  { t_shirt_id: 35, brand: 'Levi', color: 'Red', size: 'XL', price: 42, stock_quantity: 3 },

  { t_shirt_id: 36, brand: 'Levi', color: 'Blue', size: 'XS', price: 33, stock_quantity: 21 },
  { t_shirt_id: 37, brand: 'Levi', color: 'Blue', size: 'S', price: 36, stock_quantity: 36 },
  { t_shirt_id: 38, brand: 'Levi', color: 'Blue', size: 'M', price: 39, stock_quantity: 62 },
  { t_shirt_id: 39, brand: 'Levi', color: 'Blue', size: 'L', price: 41, stock_quantity: 25 },
  { t_shirt_id: 40, brand: 'Levi', color: 'Blue', size: 'XL', price: 45, stock_quantity: 14 },

  { t_shirt_id: 41, brand: 'Van Heusen', color: 'White', size: 'XS', price: 38, stock_quantity: 16 },
  { t_shirt_id: 42, brand: 'Van Heusen', color: 'White', size: 'S', price: 42, stock_quantity: 29 },
  { t_shirt_id: 43, brand: 'Van Heusen', color: 'White', size: 'M', price: 45, stock_quantity: 48 },
  { t_shirt_id: 44, brand: 'Van Heusen', color: 'White', size: 'L', price: 48, stock_quantity: 22 },
  { t_shirt_id: 45, brand: 'Van Heusen', color: 'White', size: 'XL', price: 52, stock_quantity: 8 },

  { t_shirt_id: 46, brand: 'Van Heusen', color: 'Black', size: 'XS', price: 40, stock_quantity: 12 },
  { t_shirt_id: 47, brand: 'Van Heusen', color: 'Black', size: 'S', price: 44, stock_quantity: 25 },
  { t_shirt_id: 48, brand: 'Van Heusen', color: 'Black', size: 'M', price: 48, stock_quantity: 53 },
  { t_shirt_id: 49, brand: 'Van Heusen', color: 'Black', size: 'L', price: 50, stock_quantity: 19 },
  { t_shirt_id: 50, brand: 'Van Heusen', color: 'Black', size: 'XL', price: 55, stock_quantity: 4 },

  { t_shirt_id: 51, brand: 'Van Heusen', color: 'Blue', size: 'M', price: 46, stock_quantity: 31 },
  { t_shirt_id: 52, brand: 'Van Heusen', color: 'Blue', size: 'L', price: 49, stock_quantity: 17 },

  { t_shirt_id: 53, brand: 'Adidas', color: 'White', size: 'XS', price: 24, stock_quantity: 30 },
  { t_shirt_id: 54, brand: 'Adidas', color: 'White', size: 'S', price: 26, stock_quantity: 45 },
  { t_shirt_id: 55, brand: 'Adidas', color: 'White', size: 'M', price: 29, stock_quantity: 75 },
  { t_shirt_id: 56, brand: 'Adidas', color: 'White', size: 'L', price: 32, stock_quantity: 33 },
  { t_shirt_id: 57, brand: 'Adidas', color: 'White', size: 'XL', price: 35, stock_quantity: 16 },

  { t_shirt_id: 58, brand: 'Adidas', color: 'Black', size: 'XS', price: 25, stock_quantity: 28 },
  { t_shirt_id: 59, brand: 'Adidas', color: 'Black', size: 'S', price: 28, stock_quantity: 52 },
  { t_shirt_id: 60, brand: 'Adidas', color: 'Black', size: 'M', price: 30, stock_quantity: 84 },
  { t_shirt_id: 61, brand: 'Adidas', color: 'Black', size: 'L', price: 33, stock_quantity: 39 },
  { t_shirt_id: 62, brand: 'Adidas', color: 'Black', size: 'XL', price: 36, stock_quantity: 11 },

  { t_shirt_id: 63, brand: 'Adidas', color: 'Red', size: 'S', price: 27, stock_quantity: 14 },
  { t_shirt_id: 64, brand: 'Adidas', color: 'Red', size: 'M', price: 30, stock_quantity: 26 },
  { t_shirt_id: 65, brand: 'Adidas', color: 'Blue', size: 'S', price: 28, stock_quantity: 20 },
  { t_shirt_id: 66, brand: 'Adidas', color: 'Blue', size: 'M', price: 31, stock_quantity: 49 },
  { t_shirt_id: 67, brand: 'Adidas', color: 'Blue', size: 'L', price: 34, stock_quantity: 15 }
];

export const INITIAL_DISCOUNTS: RawDiscount[] = [
  { t_shirt_id: 1, pct_discount: 10 },
  { t_shirt_id: 3, pct_discount: 15 },
  { t_shirt_id: 7, pct_discount: 20 },
  { t_shirt_id: 11, pct_discount: 25 },
  { t_shirt_id: 21, pct_discount: 10 },
  { t_shirt_id: 23, pct_discount: 15 },
  { t_shirt_id: 27, pct_discount: 20 },
  { t_shirt_id: 31, pct_discount: 30 },
  { t_shirt_id: 41, pct_discount: 10 },
  { t_shirt_id: 43, pct_discount: 15 },
  { t_shirt_id: 48, pct_discount: 20 },
  { t_shirt_id: 53, pct_discount: 10 },
  { t_shirt_id: 55, pct_discount: 15 },
  { t_shirt_id: 60, pct_discount: 25 },
  { t_shirt_id: 64, pct_discount: 40 }
];
