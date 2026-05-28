export function isBrowser() {
  return typeof window !== 'undefined';
}

export function getLocalStorageItem(key: string) {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
}

export function setLocalStorageItem(key: string, value: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, value);
}
