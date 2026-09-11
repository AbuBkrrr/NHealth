/**
 * Normalizes an error from an API call into a message safe to show in an Alert.
 * Distinguishes "no connection" from "server said no" so people aren't told
 * to fix input that was never the problem.
 */
export function getErrorMessage(err: unknown, fallback = 'Please try again.'): string {
  const anyErr = err as any;

  if (anyErr?.response?.data?.error) {
    return anyErr.response.data.error as string;
  }
  if (anyErr?.message === 'Network Error' || anyErr?.code === 'ERR_NETWORK') {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (anyErr?.code === 'ECONNABORTED') {
    return 'That took too long to respond. Please try again.';
  }
  return fallback;
}
