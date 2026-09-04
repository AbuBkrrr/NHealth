/**
 * Type guards and utilities for safe type narrowing
 * Used to safely convert Prisma Json/Decimal types to application types
 */

import { Medication } from '../controllers/types';

/**
 * Type guard to safely narrow Prisma JsonValue to Medication[]
 * Validates that the value is an array of objects with required medication fields
 */
export function isMedicationArray(value: unknown): value is Medication[] {
  if (!Array.isArray(value)) return false;
  
  return value.every((item) => {
    const med = item as Record<string, unknown>;
    return (
      typeof med.name === 'string' &&
      typeof med.dosage === 'string' &&
      typeof med.frequency === 'string' &&
      typeof med.durationDays === 'number' &&
      med.durationDays > 0
    );
  });
}

/**
 * Safely convert Prisma Decimal to number
 * Handles cases where Decimal is already a number
 */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  throw new TypeError(`Cannot convert ${typeof value} to number`);
}

/**
 * Type guard for order items from Prisma Json field
 */
export interface OrderItem {
  inventoryId: string;
  name: string;
  qty: number;
  price: number;
}

export function isOrderItemArray(value: unknown): value is OrderItem[] {
  if (!Array.isArray(value)) return false;
  
  return value.every((item) => {
    const order = item as Record<string, unknown>;
    return (
      typeof order.inventoryId === 'string' &&
      typeof order.name === 'string' &&
      typeof order.qty === 'number' &&
      order.qty > 0 &&
      typeof order.price === 'number' &&
      order.price >= 0
    );
  });
}
