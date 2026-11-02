export type Tab =
  | 'dashboard'
  | 'stats'
  | 'facebook'
  | 'tiktok'
  | 'scan'
  | 'lineLogs'
  | 'sites'
  | 'clips'
  | 'employees'
  | 'settings';

export const tabPaths: Record<Tab, string> = {
  dashboard: '/',
  stats: '/stats',
  facebook: '/facebook',
  tiktok: '/tiktok',
  scan: '/scan',
  lineLogs: '/attendance',
  sites: '/attendance/sites',
  clips: '/clips',
  employees: '/employees',
  settings: '/settings',
};
export const pathTabs = Object.fromEntries(Object.entries(tabPaths).map(([tab, path]) => [path, tab])) as Record<string, Tab | undefined>;
