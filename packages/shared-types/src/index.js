"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiErrorClass = exports.PaymentMethod = exports.PaginatedResponseSchema = exports.ApiResponseSchema = exports.RegisterSchema = exports.AuthSchema = exports.JwtPayloadSchema = exports.PaymentStatus = exports.OrderStatus = exports.AppointmentStatus = exports.Role = void 0;
const zod_1 = require("zod");
var Role;
(function (Role) {
    Role["PATIENT"] = "PATIENT";
    Role["DOCTOR"] = "DOCTOR";
    Role["PHARMACY"] = "PHARMACY";
    Role["LAB"] = "LAB";
    Role["AMBULANCE"] = "AMBULANCE";
    Role["NURSE"] = "NURSE";
    Role["ADMIN"] = "ADMIN";
})(Role || (exports.Role = Role = {}));
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["PENDING"] = "PENDING";
    AppointmentStatus["CONFIRMED"] = "CONFIRMED";
    AppointmentStatus["IN_PROGRESS"] = "IN_PROGRESS";
    AppointmentStatus["COMPLETED"] = "COMPLETED";
    AppointmentStatus["CANCELLED"] = "CANCELLED";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["PROCESSING"] = "PROCESSING";
    OrderStatus["READY"] = "READY";
    OrderStatus["OUT_FOR_DELIVERY"] = "OUT_FOR_DELIVERY";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["CONFIRMED"] = "CONFIRMED";
    PaymentStatus["EXPIRED"] = "EXPIRED";
    PaymentStatus["CANCELLED"] = "CANCELLED";
    PaymentStatus["FAILED"] = "FAILED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
exports.JwtPayloadSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    role: zod_1.z.nativeEnum(Role),
    isSuperAdmin: zod_1.z.boolean().optional(),
});
exports.AuthSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
exports.RegisterSchema = exports.AuthSchema.extend({
    name: zod_1.z.string().min(1, 'Name is required'),
    phone: zod_1.z.string().optional(),
});
exports.ApiResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.unknown().optional(),
    message: zod_1.z.string().optional(),
    error: zod_1.z.string().optional(),
});
exports.PaginatedResponseSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.unknown()),
    total: zod_1.z.number(),
    page: zod_1.z.number(),
    limit: zod_1.z.number(),
    totalPages: zod_1.z.number(),
});
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["USSD"] = "USSD";
    PaymentMethod["TRANSFER"] = "TRANSFER";
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["WALLET"] = "WALLET";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
class ApiErrorClass extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, ApiErrorClass.prototype);
    }
    static badRequest(message = 'Bad request') {
        return new ApiErrorClass(400, message);
    }
    static unauthorized(message = 'Unauthorized') {
        return new ApiErrorClass(401, message);
    }
    static forbidden(message = 'Forbidden') {
        return new ApiErrorClass(403, message);
    }
    static notFound(message = 'Not found') {
        return new ApiErrorClass(404, message);
    }
    static conflict(message = 'Conflict') {
        return new ApiErrorClass(409, message);
    }
    static internalError(message = 'Internal server error') {
        return new ApiErrorClass(500, message);
    }
}
exports.ApiErrorClass = ApiErrorClass;
