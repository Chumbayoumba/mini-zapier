import { toast } from 'sonner';

interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string | string[];
      errors?: Array<{ nodeId: string; field: string; message: string }>;
    };
  };
  code?: string;
  message?: string;
}

export function getErrorMessage(error: unknown): string {
  const err = error as ApiError;

  if (!err.response) {
    if (err.code === 'ECONNABORTED') return 'Request timeout — server is not responding';
    if (err.code === 'ERR_NETWORK') return 'Network error — check your connection';
    return 'Network error — check your connection';
  }

  const { status, data } = err.response;
  const serverMsg = Array.isArray(data?.message) ? data.message[0] : data?.message;

  switch (status) {
    case 400:
      return serverMsg || 'Invalid request data';
    case 401:
      return 'Invalid email or password';
    case 403:
      return 'Access denied';
    case 404:
      return serverMsg || 'Resource not found';
    case 409:
      return serverMsg || 'Resource already exists';
    case 422:
      return serverMsg || 'Validation error';
    case 429:
      return 'Too many requests — please try again later';
    default:
      return serverMsg || 'Server error — please try again later';
  }
}

export function getValidationErrors(error: unknown): Array<{ nodeId: string; field: string; message: string }> {
  const err = error as ApiError;
  return err.response?.data?.errors || [];
}

export function handleApiError(error: unknown, context?: string): void {
  const message = getErrorMessage(error);
  toast.error(context ? `${context}: ${message}` : message);
}
