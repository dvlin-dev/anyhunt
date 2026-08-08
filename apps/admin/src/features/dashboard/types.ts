/** Admin 首页用户统计合同。 */
export interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  adminUsers: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface ChartData {
  registrations: ChartDataPoint[];
}
