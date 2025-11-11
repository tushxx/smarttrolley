/**
 * Format price in Indian Rupees
 * @param price Price as string or number
 * @returns Formatted price string like ₹12,999
 */
export function formatIndianPrice(price: string | number): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numPrice)) {
    return '₹0';
  }
  
  // Format with Indian number system (commas every 2 digits after first 3)
  const formatted = numPrice.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  
  return `₹${formatted}`;
}
