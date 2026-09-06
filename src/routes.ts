export type Tab =
  | 'aiVideoHome'
  | 'videoIdeas'
  | 'imageGen'
  | 'storyboard'
  | 'videoRender'
  | 'videoReview'
  | 'approvedVideos'
  | 'assetLibrary'
  | 'costTracker'
  | 'dashboard'
  | 'facebook'
  | 'tiktok'
  | 'comparison'
  | 'stats'
  | 'employees'
  | 'lineLogs'
  | 'settings';


export const tabPaths: Record<Tab, string> = {
  "dashboard": "/",
  "comparison": "/comparison",
  "stats": "/stats",
  "facebook": "/facebook",
  "tiktok": "/tiktok",
  "employees": "/employees",
  "lineLogs": "/attendance",
  "settings": "/settings",
  "aiVideoHome": "/videos",
  "videoIdeas": "/videos/ideas",
  "imageGen": "/videos/images",
  "storyboard": "/videos/storyboard",
  "videoRender": "/videos/render",
  "videoReview": "/videos/review",
  "approvedVideos": "/videos/approved",
  "assetLibrary": "/assets",
  "costTracker": "/costs"
};
export const pathTabs = Object.fromEntries(Object.entries(tabPaths).map(([tab, path]) => [path, tab])) as Record<string, Tab | undefined>;
