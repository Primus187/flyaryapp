import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// VAPID public key - must match the one stored as secret
const VAPID_PUBLIC_KEY = "BBczYHIWEXzZrq7mbCQRKwvPjn3KmG2BSvDJzH9H5i_NaUUiz-k8RYGtasQt8Bo_bZCNQJoL8YiojLZ82KwG2Q8";

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

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
  }, []);

  useEffect(() => {
    if (!isSupported || !user) return;
    checkSubscription();
  }, [isSupported, user]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
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

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
        }));

      const json = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions" as any).upsert(
        {
          user_id: user.id,
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
        await supabase.from("push_subscriptions" as any).delete().eq("user_id", user.id).eq("endpoint", subscription.endpoint);
      }
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

  return { isSupported, isSubscribed, loading, subscribe, unsubscribe, toggle };
}
