import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { forgetPushEnabled, getRememberedPushEndpoint, rememberPushEnabled, shouldRestorePush } from "@/lib/push-restore";

// VAPID public key - must match the one stored as secret
const VAPID_PUBLIC_KEY = "BIEnpSUrBz_zhtCQpVsNxSlHd3NPqKWXvphXlssKzs7idyEtvGsY6w3ckKN2RDTthZZkLoGOlu01ntX1iFARvCE";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushSubscribeReason =
  | "no_user"
  | "unsupported"
  | "ios_install_required"
  | "blocked"
  | "dismissed"
  | "save_failed"
  | "failed";

export type PushSubscribeResult = { ok: boolean; reason?: PushSubscribeReason; message?: string };

/**
 * Creates (or reuses) the push subscription of this device and saves it. Needs the permission already granted.
 * Several components use the hook at once: parallel calls share one run.
 */
let pendingSubscription: Promise<PushSubscribeResult> | null = null;
function ensureSubscription(userId: string): Promise<PushSubscribeResult> {
  pendingSubscription ??= createSubscription(userId).finally(() => { pendingSubscription = null; });
  return pendingSubscription;
}

async function createSubscription(userId: string): Promise<PushSubscribeResult> {
  const registration = await navigator.serviceWorker.ready;
  const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

  // Drop a subscription created with an older server key — it can no longer receive messages.
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const currentKey = existing.options?.applicationServerKey;
    const matches =
      !!currentKey &&
      new Uint8Array(currentKey as ArrayBuffer).every((b, i) => b === appServerKey[i]) &&
      (currentKey as ArrayBuffer).byteLength === appServerKey.length;
    if (!matches) {
      await existing.unsubscribe();
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", existing.endpoint);
    }
  }

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey.buffer as ArrayBuffer,
    }));

  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      keys_p256dh: json.keys?.p256dh || "",
      keys_auth: json.keys?.auth || "",
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error) {
    console.error("Push subscription save error:", error);
    return { ok: false, reason: "save_failed", message: error.message };
  }

  // The previous subscription of this device died with the old service worker: drop its row.
  const previous = getRememberedPushEndpoint(userId);
  if (previous && previous !== subscription.endpoint) {
    await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", previous);
  }
  rememberPushEnabled(userId, subscription.endpoint);
  return { ok: true };
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  // false until the subscription state is known – keeps the dashboard prompt from flashing up
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
  }, []);

  useEffect(() => {
    if (!isSupported || !user) return;
    checkSubscription();
  }, [isSupported, user]);

  const checkSubscription = async () => {
    if (!user) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (shouldRestorePush(Notification.permission, getRememberedPushEndpoint(user.id), !!subscription)) {
        // An app update dropped the subscription while push was on: switch it back on silently.
        const restored = await ensureSubscription(user.id);
        setIsSubscribed(restored.ok);
      } else {
        // Also marks subscriptions made before this marker existed, so the next update restores them.
        if (subscription) rememberPushEnabled(user.id, subscription.endpoint);
        setIsSubscribed(!!subscription);
      }
    } catch {
      setIsSubscribed(false);
    } finally {
      setChecked(true);
    }
  };

  const subscribe = useCallback(async (): Promise<PushSubscribeResult> => {
    if (!user) return { ok: false, reason: "no_user" };
    if (!isSupported) return { ok: false, reason: "unsupported" };

    // iOS/iPadOS only allows web push when the app is installed to the home screen.
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isIos && !standalone) return { ok: false, reason: "ios_install_required" };

    setLoading(true);
    try {
      if (Notification.permission === "denied") {
        return { ok: false, reason: "blocked" };
      }

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        return { ok: false, reason: permission === "denied" ? "blocked" : "dismissed" };
      }

      const result = await ensureSubscription(user.id);
      if (!result.ok) return result;
      setIsSubscribed(true);
      return { ok: true };
    } catch (e: any) {
      console.error("Push subscribe error:", e);
      return { ok: false, reason: "failed", message: e?.message };
    } finally {
      setLoading(false);
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", subscription.endpoint);
      }
      forgetPushEnabled(user.id);
      setIsSubscribed(false);
    } catch (e) {
      console.error("Push unsubscribe error:", e);
    }
    setLoading(false);
  }, [user]);

  const toggle = useCallback(async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }, [isSubscribed, subscribe, unsubscribe]);

  return { isSupported, isSubscribed, checked, loading, subscribe, unsubscribe, toggle };
}
