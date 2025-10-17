export const API_HEADERS = import.meta.env.VITE_API_KEY
  ? { 'x-api-key': import.meta.env.VITE_API_KEY as string }
  : undefined;

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  timestamp: string;
};
