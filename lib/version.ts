// 版本管理工具
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();

// 检查是否有新版本
export function checkForUpdates(): boolean {
  if (typeof window === 'undefined') return false;
  
  const storedVersion = localStorage.getItem('app_version');
  const storedBuildTime = localStorage.getItem('app_build_time');
  
  if (!storedVersion || storedVersion !== APP_VERSION) {
    localStorage.setItem('app_version', APP_VERSION);
    localStorage.setItem('app_build_time', BUILD_TIME);
    return true;
  }
  
  if (!storedBuildTime || storedBuildTime !== BUILD_TIME) {
    localStorage.setItem('app_build_time', BUILD_TIME);
    return true;
  }
  
  return false;
}

// 强制刷新应用
export function forceRefresh(): void {
  if (typeof window === 'undefined') return;
  
  // 清除所有缓存
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
    });
  }
  
  // 清除本地存储中的缓存相关数据
  const keysToKeep = ['userProfile', 'aiConfig', 'auth_token'];
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (!keysToKeep.includes(key)) {
      localStorage.removeItem(key);
    }
  });
  
  // 强制刷新页面
  window.location.reload();
}

// 获取版本信息
export function getVersionInfo() {
  return {
    version: APP_VERSION,
    buildTime: BUILD_TIME,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown'
  };
}
