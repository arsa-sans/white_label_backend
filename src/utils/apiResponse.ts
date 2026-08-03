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

export const ApiResponse = {
  success<T>(
    data: T,
    message?: string,
    meta?: PaginationMeta | Record<string, unknown>
  ): SuccessResponse<T> {
    return { success: true, data, ...(message && { message }), ...(meta && { meta }) };
  },

  error(message: string, statusCode = 500): ErrorResponse {
    return { success: false, error: message, statusCode };
  },

  paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): SuccessResponse<T[]> {
    const totalPages = Math.ceil(total / limit);
    return {
      success: true,
      data,
      meta: { page, limit, total, totalPages },
    };
  },
};
