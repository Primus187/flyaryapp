/**
 * Remembers per device and user that push was switched on. An app update or the stale-version repair
 * unregisters the service worker, and with it the push subscription – the browser permission stays.
 * With this marker the app subscribes again on its own instead of asking the user once more.
 */
const key = (userId: string) => `push-enabled:${userId}`;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const defaultStore = (): Store | null => {
  try { return window.localStorage; } catch { return null; }
};

/** Endpoint of the last subscription saved on this device, or null when push was not switched on here. */
export function getRememberedPushEndpoint(userId: string, store: Store | null = defaultStore()): string | null {
  try { return store?.getItem(key(userId)) ?? null; } catch { return null; }
}

export function rememberPushEnabled(userId: string, endpoint: string, store: Store | null = defaultStore()) {
  try { store?.setItem(key(userId), endpoint); } catch { /* private mode */ }
}

export function forgetPushEnabled(userId: string, store: Store | null = defaultStore()) {
  try { store?.removeItem(key(userId)); } catch { /* private mode */ }
}

/** Subscribe again without asking: push was on before, the permission still holds, only the subscription is gone. */
export function shouldRestorePush(permission: NotificationPermission, rememberedEndpoint: string | null, hasSubscription: boolean): boolean {
  return permission === "granted" && !!rememberedEndpoint && !hasSubscription;
}
