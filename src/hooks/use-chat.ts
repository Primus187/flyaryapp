import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatChannel } from "@/lib/chat";

export const CHAT_INBOX_KEY = (userId: string | undefined) => ["chat-inbox", userId] as const;

/** All channels the user can read, with last message and unread count (one RPC). */
export function useChatInbox() {
  const { user } = useAuth();
  return useQuery({
    queryKey: CHAT_INBOX_KEY(user?.id),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("chat_inbox");
      if (error) throw error;
      return (data as unknown as ChatChannel[]) || [];
    },
  });
}

/** Mounted once in the app shell: refresh the inbox when a message arrives in a visible channel
 *  (Realtime only delivers rows the user may read, RLS applies). */
export function useChatInboxLive() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-inbox-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: CHAT_INBOX_KEY(user.id) });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, queryClient]);
}

/** A single channel (by id or by event); null when the user may not read it. */
export function useChatChannel(params: { channelId?: string; eventId?: string }) {
  const { user } = useAuth();
  const { channelId, eventId } = params;
  return useQuery({
    queryKey: ["chat-channel", user?.id, channelId ?? null, eventId ?? null],
    enabled: !!user && !!(channelId || eventId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = channelId
        ? await supabase.rpc("chat_channel_json", { _channel: channelId })
        : await supabase.rpc("chat_event_channel", { _event: eventId });
      if (error) throw error;
      return (data as unknown as ChatChannel | null) ?? null;
    },
  });
}

export interface DirectCandidate { user_id: string; pilot_name: string; groups: string[] }

/** People the user can write to directly (everyone sharing at least one group). */
export function useDirectCandidates(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["chat-direct-candidates", user?.id],
    enabled: !!user && enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("chat_direct_candidates");
      if (error) throw error;
      return (data as unknown as DirectCandidate[]) || [];
    },
  });
}

/** Opens (creates if needed) the direct channel with another person; returns its id. */
export async function openDirectChannel(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc("chat_open_direct", { _other: otherUserId });
  if (error) throw error;
  return data as unknown as string;
}

export interface ChatSearchHit {
  id: string; channel_id: string; message: string; created_at: string; author: string;
  channel: string | null; kind: "group" | "event" | "direct" | "listing"; group_name: string | null;
}

/** Messages containing the query across every readable channel (at least 2 characters). */
export function useChatSearch(query: string) {
  const { user } = useAuth();
  const q = query.trim();
  return useQuery({
    queryKey: ["chat-search", user?.id, q],
    enabled: !!user && q.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("chat_search", { _q: q });
      if (error) throw error;
      return (data as unknown as ChatSearchHit[]) || [];
    },
  });
}
