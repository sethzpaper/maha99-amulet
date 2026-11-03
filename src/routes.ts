export type Tab =
  | 'dashboard'
  | 'stats'
  | 'facebook'
  | 'scan'
  | 'lineLogs'
  | 'sites'
  | 'clips'
  | 'calendar'
  | 'employees'
  | 'settings';

export const tabPaths: Record<Tab, string> = {
  dashboard: '/',
  stats: '/stats',
  facebook: '/facebook',
  scan: '/scan',
  lineLogs: '/attendance',
  sites: '/attendance/sites',
  clips: '/clips',
  calendar: '/calendar',
  employees: '/employees',
  settings: '/settings',
};
export const pathTabs = Object.fromEntries(Object.entries(tabPaths).map(([tab, path]) => [path, tab])) as Record<string, Tab | undefined>;
