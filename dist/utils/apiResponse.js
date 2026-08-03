"use strict";
/**
 * src/utils/apiResponse.ts
 * Standardized API response format across all endpoints.
 *
 * Success:  { success: true, data: T, message?: string, meta?: object }
 * Error:    { success: false, error: string, statusCode: number }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
exports.ApiResponse = {
    success(data, message, meta) {
        return { success: true, data, ...(message && { message }), ...(meta && { meta }) };
    },
    error(message, statusCode = 500) {
        return { success: false, error: message, statusCode };
    },
    paginated(data, page, limit, total) {
        const totalPages = Math.ceil(total / limit);
        return {
            success: true,
            data,
            meta: { page, limit, total, totalPages },
        };
    },
};
//# sourceMappingURL=apiResponse.js.map