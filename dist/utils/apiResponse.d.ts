/**
 * src/utils/apiResponse.ts
 * Standardized API response format across all endpoints.
 *
 * Success:  { success: true, data: T, message?: string, meta?: object }
 * Error:    { success: false, error: string, statusCode: number }
 */
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface SuccessResponse<T> {
    success: true;
    data: T;
    message?: string;
    meta?: PaginationMeta | Record<string, unknown>;
}
export interface ErrorResponse {
    success: false;
    error: string;
    statusCode: number;
}
export declare const ApiResponse: {
    success<T>(data: T, message?: string, meta?: PaginationMeta | Record<string, unknown>): SuccessResponse<T>;
    error(message: string, statusCode?: number): ErrorResponse;
    paginated<T>(data: T[], page: number, limit: number, total: number): SuccessResponse<T[]>;
};
//# sourceMappingURL=apiResponse.d.ts.map