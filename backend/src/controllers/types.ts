/**
 * Centralized type definitions for controller layer
 */

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
}

export interface OrderItem {
  inventoryId: string;
  name: string;
  qty: number;
  price: number;
}

export interface LabResultParameter {
  parameter: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: string;
}

export interface LabResultData {
  results: LabResultParameter[];
  notes?: string;
}
