/**
 * 共享类型定义
 */

/** 分页信息 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

/** Admin Operations API 使用的扁平分页响应。 */
export interface AdminPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
