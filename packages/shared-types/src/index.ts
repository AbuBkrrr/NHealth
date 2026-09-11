import { z } from 'zod';

// ============ Enums ============

export enum Role {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  PHARMACY = 'PHARMACY',
  LAB = 'LAB',
  AMBULANCE = 'AMBULANCE',
  NURSE = 'NURSE',
  ADMIN = 'ADMIN',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

// ============ Zod Schemas ============

/**
 * JWT payload schema for token verification.
 */
export const JwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(Role),
  isSuperAdmin: z.boolean().optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

/**
 * User authentication request schema.
 */
export const AuthSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type AuthRequest = z.infer<typeof AuthSchema>;

/**
 * User registration schema (common fields).
 */
export const RegisterSchema = AuthSchema.extend({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
});

export type RegisterRequest = z.infer<typeof RegisterSchema>;

/**
 * Generic API response envelope.
 */
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & {
  data?: T;
};

/**
 * Paginated response envelope.
 */
export const PaginatedResponseSchema = z.object({
  items: z.array(z.unknown()),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export type PaginatedResponse<T = unknown> = Omit<
  z.infer<typeof PaginatedResponseSchema>,
  'items'
> & {
  items: T[];
};

// ============ User Types ============

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  role: Role;
  name: string;
  avatarUrl?: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Payment Types ============

export enum PaymentMethod {
  USSD = 'USSD',
  TRANSFER = 'TRANSFER',
  CARD = 'CARD',
  WALLET = 'WALLET',
}

export interface Payment {
  id: string;
  payerId: string;
  amount: number | string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  providerUserId?: string | null;
  ussdCode?: string | null;
  transferBankName?: string | null;
  transferAccountName?: string | null;
  transferAccountNumber?: string | null;
  expiresAt: Date;
  confirmedAt?: Date | null;
  confirmedById?: string | null;
  createdAt: Date;
}

// ============ Error Types ============

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: string;
  statusCode: number;
}

export class ApiErrorClass extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiErrorClass.prototype);
  }

  static badRequest(message = 'Bad request'): ApiErrorClass {
    return new ApiErrorClass(400, message);
  }

  static unauthorized(message = 'Unauthorized'): ApiErrorClass {
    return new ApiErrorClass(401, message);
  }

  static forbidden(message = 'Forbidden'): ApiErrorClass {
    return new ApiErrorClass(403, message);
  }

  static notFound(message = 'Not found'): ApiErrorClass {
    return new ApiErrorClass(404, message);
  }

  static conflict(message = 'Conflict'): ApiErrorClass {
    return new ApiErrorClass(409, message);
  }

  static internalError(message = 'Internal server error'): ApiErrorClass {
    return new ApiErrorClass(500, message);
  }
}

// ============ Request/Response Types ============

/**
 * Express Request extended with authenticated user.
 */
export interface AuthenticatedRequest {
  user?: {
    userId: string;
    role: Role;
    isSuperAdmin: boolean;
  };
}

// ============ Socket.io Event Types ============

export interface SocketPayload<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
}
