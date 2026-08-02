export type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  code?: string;
  message?: string;
  requestId?: string;
  details?: unknown;
  errors?: Array<{ field?: string; message: string }>;
};

export type AuthMode = 'public' | 'bearer' | 'apiKey';
export type QueryPrimitive = string | number | boolean | null | undefined;
export type QueryValue = QueryPrimitive | QueryPrimitive[];
export type QueryParams = Record<string, QueryValue>;
export type ApiBody =
  | string
  | FormData
  | Blob
  | URLSearchParams
  | ArrayBuffer
  | ArrayBufferView
  | null
  | undefined
  | object;
export type ResponseType = 'json' | 'raw' | 'blob' | 'stream';
export type ApiTokenGetter = () => string | null | Promise<string | null>;
export type UnauthorizedHandler = () => boolean | Promise<boolean>;

export interface TransportRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: HeadersInit;
  query?: QueryParams;
  body?: ApiBody;
  signal?: AbortSignal;
  timeoutMs?: number;
  redirect?: RequestRedirect;
  responseType?: ResponseType;
}

export interface ApiTransportConfig {
  baseUrl: string;
  fetcher?: typeof fetch;
  defaultHeaders?: HeadersInit;
  timeoutMs?: number;
}

export interface ApiTransport {
  request<T>(request: TransportRequest): Promise<T>;
}

export interface ApiClientRequestOptions {
  method?: TransportRequest['method'];
  headers?: HeadersInit;
  query?: QueryParams;
  body?: ApiBody;
  signal?: AbortSignal;
  timeoutMs?: number;
  redirect?: RequestRedirect;
  authMode?: AuthMode;
}

export interface ApiClientConfig {
  baseUrl?: string;
  transport?: ApiTransport;
  defaultAuthMode?: AuthMode;
  getAccessToken?: ApiTokenGetter;
  getApiKey?: ApiTokenGetter;
  onUnauthorized?: UnauthorizedHandler;
}

export interface ApiClient {
  get<T>(path: string, options?: Omit<ApiClientRequestOptions, 'body'>): Promise<T>;
  post<T>(path: string, options?: ApiClientRequestOptions): Promise<T>;
  put<T>(path: string, options?: ApiClientRequestOptions): Promise<T>;
  patch<T>(path: string, options?: ApiClientRequestOptions): Promise<T>;
  del<T>(path: string, options?: ApiClientRequestOptions): Promise<T>;
  raw(path: string, options?: ApiClientRequestOptions): Promise<Response>;
  blob(path: string, options?: ApiClientRequestOptions): Promise<Blob>;
  stream(path: string, options?: ApiClientRequestOptions): Promise<Response>;
}
