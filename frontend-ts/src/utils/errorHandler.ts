/**
 * Error handling utilities for better UX
 * Converts raw API errors into user-friendly messages
 */

export interface ApiError {
  error?: string;
  message?: string;
  code?: string;
  status?: number;
  details?: Record<string, string>;
}

const ERROR_MESSAGES: Record<string, string> = {
  // HTTP errors
  400: 'Invalid request. Please check your input and try again.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Server error. Please try again in a few moments.',
  503: 'Service unavailable. Please try again later.',

  // Auth errors
  EMAIL_NOT_VERIFIED: 'Please verify your email address before continuing.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_DISABLED: 'Your account has been disabled. Contact support.',
  PASSWORD_EXPIRED: 'Your password has expired. Please reset it.',

  // Data errors
  NOT_FOUND: 'The requested record was not found.',
  DUPLICATE: 'This record already exists.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  OWNERSHIP_ERROR: 'You do not have permission to access this resource.',

  // File errors
  FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
  INVALID_FILE_TYPE: 'This file type is not supported.',
  UPLOAD_FAILED: 'Failed to upload file. Please try again.',

  // Network errors
  NETWORK_ERROR: 'Network connection failed. Please check your internet.',
  TIMEOUT: 'Request timed out. Please try again.',
};

export function formatApiError(error: unknown): string {
  // Handle Fetch API errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  // Handle Error object
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Check for network-related errors
    if (msg.includes('network') || msg.includes('offline')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return ERROR_MESSAGES.TIMEOUT;
    }

    // Check for specific API error codes in message
    for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
      if (msg.includes(code.toLowerCase())) {
        return message;
      }
    }

    // Return the error message if it's readable
    if (error.message && error.message.length > 10 && error.message.length < 200) {
      return error.message;
    }
  }

  // Handle API response objects
  if (typeof error === 'object' && error !== null) {
    const apiErr = error as ApiError;

    // Check for HTTP status-based messages
    if (apiErr.status && ERROR_MESSAGES[String(apiErr.status)]) {
      return ERROR_MESSAGES[String(apiErr.status)];
    }

    // Check for code-based messages
    if (apiErr.code && ERROR_MESSAGES[apiErr.code]) {
      return ERROR_MESSAGES[apiErr.code];
    }

    // Return custom error message
    if (apiErr.error && typeof apiErr.error === 'string' && apiErr.error.length > 5) {
      return apiErr.error;
    }
    if (apiErr.message && typeof apiErr.message === 'string' && apiErr.message.length > 5) {
      return apiErr.message;
    }
  }

  // Handle string errors
  if (typeof error === 'string' && error.length > 5) {
    return error;
  }

  // Fallback
  return 'An unexpected error occurred. Please try again.';
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return error.message.includes('fetch') || error.message.includes('network');
  }
  if (typeof error === 'object' && error !== null) {
    const apiErr = error as ApiError;
    return apiErr.status === 0 || (apiErr.code?.includes('NETWORK') ?? false);
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const apiErr = error as ApiError;
    return apiErr.status === 401 || apiErr.status === 403 || 
           (apiErr.code != null && ['EMAIL_NOT_VERIFIED', 'INVALID_CREDENTIALS', 'ACCOUNT_DISABLED'].includes(apiErr.code));
  }
  return false;
}

export function isNotFoundError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const apiErr = error as ApiError;
    return apiErr.status === 404 || apiErr.code === 'NOT_FOUND';
  }
  return false;
}
