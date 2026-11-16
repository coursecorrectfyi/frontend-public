'use client';

import { isApiError, isNetworkError, isNotFound, isRateLimited } from '@/api/errors';
import { Alert, Button } from '@mui/material';
import type { ReactNode } from 'react';

export const NETWORK_ERROR_TEXT = "Couldn't reach CourseCorrect. Check your connection and try again.";

interface ErrorTextOptions {
  /** Shown for a 404; without it, a 404 is treated like any other error. */
  notFound?: string;
  /** Shown for anything without a more specific text (server errors, unexpected responses). */
  fallback: string;
}

/**
 * What to tell the user about a failed request (see src/api/errors.ts):
 * not found → `notFound`; rate limited → the backend's own message; no connection → NETWORK_ERROR_TEXT;
 * anything else → `fallback`.
 */
export function errorText(error: unknown, { notFound, fallback }: ErrorTextOptions): string {
  if (notFound && isNotFound(error)) return notFound;
  if (isRateLimited(error)) return error.message;
  if (isNetworkError(error)) return NETWORK_ERROR_TEXT;
  return fallback;
}

/** Whether trying the same request again can help: no connection, server problems, rate limits. Not other 4xx. */
export function isRetryable(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  if (!isApiError(error)) return false;
  return error.status === 429 || error.status >= 500;
}

interface QueryErrorAlertProps extends ErrorTextOptions {
  error: unknown;
  /** Offered as "Try again" when the error is retryable. */
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}

/** An error alert for a failed request, with "Try again" when retrying can help. */
export default function QueryErrorAlert({ error, onRetry, retryLabel = 'Try again', notFound, fallback, children }: QueryErrorAlertProps) {
  const canRetry = !!onRetry && isRetryable(error);
  return (
    <Alert
      severity={isNotFound(error) && notFound ? 'info' : 'error'}
      action={
        canRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    >
      {errorText(error, { notFound, fallback })}
      {children}
    </Alert>
  );
}
