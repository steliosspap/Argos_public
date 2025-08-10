/**
 * Currency formatting utilities for arms deals
 */

interface FormatOptions {
  currency?: string;
  compact?: boolean;
  showCurrency?: boolean;
}

/**
 * Parse a value string like "45000.0 M" to a number
 */
export function parseMonetaryValue(value: string | number): number {
  if (!value) return 0;
  
  // If already a number, return it
  if (typeof value === 'number') return value;
  
  // Handle string values
  const strValue = String(value).trim();
  
  // Handle special cases like "45000.0 M" where M means millions
  const specialMatch = strValue.match(/^([\d,]+\.?\d*)\s*([MBKTmbtk])\b/i);
  if (specialMatch) {
    const num = parseFloat(specialMatch[1].replace(/,/g, ''));
    const multiplier = specialMatch[2].toUpperCase();
    
    switch (multiplier) {
      case 'K': return num * 1000;
      case 'M': return num * 1000000;
      case 'B': return num * 1000000000;
      case 'T': return num * 1000000000000;
      default: return num;
    }
  }
  
  // Check if the number is very large (likely already in millions)
  // If a raw number > 1000, assume it's already in millions
  const rawNum = parseFloat(strValue.replace(/[^0-9.-]/g, ''));
  if (!isNaN(rawNum) && rawNum > 1000) {
    // Assume the value is already in millions
    return rawNum * 1000000;
  }
  
  // Try to parse as regular number
  const cleanValue = strValue.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleanValue);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  value: number | string,
  options: FormatOptions = {}
): string {
  const {
    currency = 'USD',
    compact = true,
    showCurrency = false // Default to false for cleaner display
  } = options;
  
  // Parse string values - handles "45000.0 M" format
  const numValue = parseMonetaryValue(value);
  
  if (isNaN(numValue) || numValue === 0) {
    return showCurrency ? `$0 ${currency}` : '$0';
  }
  
  // Format based on size
  if (compact) {
    if (numValue >= 1e12) {
      const formatted = (numValue / 1e12).toFixed(1).replace('.0', '');
      return showCurrency ? `$${formatted}T ${currency}` : `$${formatted}T`;
    } else if (numValue >= 1e9) {
      const formatted = (numValue / 1e9).toFixed(1).replace('.0', '');
      return showCurrency ? `$${formatted}B ${currency}` : `$${formatted}B`;
    } else if (numValue >= 1e6) {
      const formatted = (numValue / 1e6).toFixed(1).replace('.0', '');
      return showCurrency ? `$${formatted}M ${currency}` : `$${formatted}M`;
    } else if (numValue >= 1e3) {
      const formatted = (numValue / 1e3).toFixed(1).replace('.0', '');
      return showCurrency ? `$${formatted}K ${currency}` : `$${formatted}K`;
    }
  }
  
  // Full format for smaller values
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return formatter.format(numValue);
}

/**
 * Format quantity with units
 */
export function formatQuantity(value: number | string, unit?: string): string {
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (isNaN(numValue) || numValue === 0) {
    return unit ? `0 ${unit}` : '0';
  }
  
  const formatter = new Intl.NumberFormat('en-US');
  const formatted = formatter.format(numValue);
  
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Parse unit from description or title
 */
export function parseUnit(text: string): string | null {
  if (!text) return null;
  
  // Common military equipment units
  const unitPatterns = [
    /(\d+)\s*(aircraft|planes?|jets?|helicopters?)/i,
    /(\d+)\s*(tanks?|vehicles?|apcs?|ifvs?)/i,
    /(\d+)\s*(missiles?|rockets?|bombs?)/i,
    /(\d+)\s*(ships?|vessels?|boats?|submarines?)/i,
    /(\d+)\s*(guns?|rifles?|weapons?|systems?)/i,
    /(\d+)\s*(rounds?|shells?|ammunition)/i,
    /(\d+)\s*(units?|pieces?|items?)/i,
  ];
  
  for (const pattern of unitPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[2].toLowerCase();
    }
  }
  
  return null;
}

/**
 * Format arms deal for display
 */
export interface ArmsDeal {
  id: string;
  supplier: string;
  recipient: string;
  weapon_type: string;
  quantity?: number | string;
  value?: number | string;
  status: string;
  order_date: string;
  delivery_date?: string;
  description?: string;
}

export function formatArmsDeal(deal: ArmsDeal) {
  const quantity = deal.quantity ? formatQuantity(deal.quantity, parseUnit(deal.weapon_type) || 'units') : 'Unknown quantity';
  const value = deal.value ? formatCurrency(deal.value) : 'Undisclosed';
  
  return {
    ...deal,
    formattedQuantity: quantity,
    formattedValue: value,
    displayTitle: `${deal.supplier} → ${deal.recipient}: ${deal.weapon_type}`,
    displaySubtitle: `${quantity} • ${value}`
  };
}