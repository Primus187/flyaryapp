export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcement_read_receipts: {
        Row: {
          confirmed_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_report_submissions: {
        Row: {
          created_at: string
          group_id: string
          id: string
          submitted_at: string | null
          submitted_by: string | null
          year: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          year: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "annual_report_submissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_items: {
        Row: {
          amount: number
          billing_date: string
          created_at: string
          created_by: string
          description: string | null
          event_id: string | null
          group_id: string
          id: string
          item_type: string
          listing_id: string | null
          note: string | null
          paid_at: string | null
          quantity: number
          unit_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          billing_date?: string
          created_at?: string
          created_by: string
          description?: string | null
          event_id?: string | null
          group_id: string
          id?: string
          item_type?: string
          listing_id?: string | null
          note?: string | null
          paid_at?: string | null
          quantity?: number
          unit_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_date?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_id?: string | null
          group_id?: string
          id?: string
          item_type?: string
          listing_id?: string | null
          note?: string | null
          paid_at?: string | null
          quantity?: number
          unit_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          achievement_id: string | null
          created_at: string
          event_id: string | null
          flight_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          achievement_id?: string | null
          created_at?: string
          event_id?: string | null
          flight_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string | null
          created_at?: string
          event_id?: string | null
          flight_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "feed_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_goals: {
        Row: {
          challenge_id: string
          goal_type: string
          id: string
          label: string | null
          latitude: number | null
          location_id: string | null
          longitude: number | null
          points: number
          radius_meters: number
          sort_order: number
        }
        Insert: {
          challenge_id: string
          goal_type?: string
          id?: string
          label?: string | null
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          points?: number
          radius_meters?: number
          sort_order?: number
        }
        Update: {
          challenge_id?: string
          goal_type?: string
          id?: string
          label?: string | null
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          points?: number
          radius_meters?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_goals_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_goals_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string
          flight_id: string | null
          goal_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          flight_id?: string | null
          goal_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          flight_id?: string | null
          goal_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_progress_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "challenge_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          challenge_type: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          group_id: string
          id: string
          start_date: string
          title: string
        }
        Insert: {
          challenge_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          group_id: string
          id?: string
          start_date?: string
          title: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          group_id?: string
          id?: string
          start_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channel_members: {
        Row: {
          added_by: string | null
          channel_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          channel_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          channel_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          archived_at: string | null
          audience: string
          audience_levels: string[] | null
          buyer_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          direct_key: string | null
          event_id: string | null
          group_id: string | null
          id: string
          is_default: boolean
          kind: string
          last_message_at: string | null
          listing_id: string | null
          name: string | null
          staff_only_posting: boolean
        }
        Insert: {
          archived_at?: string | null
          audience?: string
          audience_levels?: string[] | null
          buyer_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direct_key?: string | null
          event_id?: string | null
          group_id?: string | null
          id?: string
          is_default?: boolean
          kind: string
          last_message_at?: string | null
          listing_id?: string | null
          name?: string | null
          staff_only_posting?: boolean
        }
        Update: {
          archived_at?: string | null
          audience?: string
          audience_levels?: string[] | null
          buyer_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direct_key?: string | null
          event_id?: string | null
          group_id?: string | null
          id?: string
          is_default?: boolean
          kind?: string
          last_message_at?: string | null
          listing_id?: string | null
          name?: string | null
          staff_only_posting?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_receipts: {
        Row: {
          confirmed_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_path: string | null
          channel_id: string
          created_at: string
          edited_at: string | null
          id: string
          is_announcement: boolean
          mentions: string[]
          message: string
          reply_to: string | null
          requires_confirmation: boolean
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          channel_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_announcement?: boolean
          mentions?: string[]
          message?: string
          reply_to?: string | null
          requires_confirmation?: boolean
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          channel_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_announcement?: boolean
          mentions?: string[]
          message?: string
          reply_to?: string | null
          requires_confirmation?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_push_state: {
        Row: {
          channel_id: string
          last_pushed_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_pushed_at: string
          user_id: string
        }
        Update: {
          channel_id?: string
          last_pushed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_push_state_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_state: {
        Row: {
          channel_id: string
          last_read_at: string
          notify_level: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_read_at?: string
          notify_level?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string
          notify_level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_state_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      client_error_quota: {
        Row: {
          hour: string
          reporter: string | null
          reports: number
        }
        Insert: {
          hour: string
          reporter?: string | null
          reports?: number
        }
        Update: {
          hour?: string
          reporter?: string | null
          reports?: number
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          app_version: string | null
          created_at: string
          fingerprint: string
          id: string
          kind: string
          last_seen_at: string
          message: string
          occurrences: number
          path: string | null
          resolved_at: string | null
          stack: string | null
          user_agent: string | null
          user_ids: string[]
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          fingerprint: string
          id?: string
          kind: string
          last_seen_at?: string
          message: string
          occurrences?: number
          path?: string | null
          resolved_at?: string | null
          stack?: string | null
          user_agent?: string | null
          user_ids?: string[]
        }
        Update: {
          app_version?: string | null
          created_at?: string
          fingerprint?: string
          id?: string
          kind?: string
          last_seen_at?: string
          message?: string
          occurrences?: number
          path?: string | null
          resolved_at?: string | null
          stack?: string | null
          user_agent?: string | null
          user_ids?: string[]
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "feed_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_data_access_log: {
        Row: {
          accessed_at: string
          accessed_by: string
          context_event_id: string | null
          group_id: string
          id: string
          profile_id: string
        }
        Insert: {
          accessed_at?: string
          accessed_by: string
          context_event_id?: string | null
          group_id: string
          id?: string
          profile_id: string
        }
        Update: {
          accessed_at?: string
          accessed_by?: string
          context_event_id?: string | null
          group_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_data_access_log_context_event_id_fkey"
            columns: ["context_event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_data_access_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_assignments: {
        Row: {
          assigned_on: string
          created_at: string
          created_by: string
          due_on: string | null
          equipment_id: string
          event_id: string | null
          group_id: string
          id: string
          note: string | null
          returned_on: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_on?: string
          created_at?: string
          created_by?: string
          due_on?: string | null
          equipment_id: string
          event_id?: string | null
          group_id: string
          id?: string
          note?: string | null
          returned_on?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_on?: string
          created_at?: string
          created_by?: string
          due_on?: string | null
          equipment_id?: string
          event_id?: string | null
          group_id?: string
          id?: string
          note?: string | null
          returned_on?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assignments_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "school_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_checks: {
        Row: {
          checked_at: string
          checked_by: string
          group_id: string
          id: string
          item: string
          note: string | null
          present: boolean
          student_user_id: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string
          group_id: string
          id?: string
          item: string
          note?: string | null
          present?: boolean
          student_user_id: string
        }
        Update: {
          checked_at?: string
          checked_by?: string
          group_id?: string
          id?: string
          item?: string
          note?: string | null
          present?: boolean
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_checks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_at: string
          equipment_id: string
          group_id: string
          id: string
          maintenance_type: string
          note: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at: string
          equipment_id: string
          group_id: string
          id?: string
          maintenance_type: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string
          equipment_id?: string
          group_id?: string
          id?: string
          maintenance_type?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "school_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_maintenance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      event_briefing_tasks: {
        Row: {
          assigned_user_id: string | null
          event_id: string
          id: string
          label: string
          sort_order: number
          task_type: string
        }
        Insert: {
          assigned_user_id?: string | null
          event_id: string
          id?: string
          label: string
          sort_order?: number
          task_type?: string
        }
        Update: {
          assigned_user_id?: string | null
          event_id?: string
          id?: string
          label?: string
          sort_order?: number
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_briefing_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_carpool_riders: {
        Row: {
          carpool_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          carpool_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          carpool_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_carpool_riders_carpool_id_fkey"
            columns: ["carpool_id"]
            isOneToOne: false
            referencedRelation: "event_carpools"
            referencedColumns: ["id"]
          },
        ]
      }
      event_carpools: {
        Row: {
          created_at: string
          departure_place: string | null
          departure_time: string | null
          driver_user_id: string
          event_id: string
          id: string
          seats: number
        }
        Insert: {
          created_at?: string
          departure_place?: string | null
          departure_time?: string | null
          driver_user_id: string
          event_id: string
          id?: string
          seats?: number
        }
        Update: {
          created_at?: string
          departure_place?: string | null
          departure_time?: string | null
          driver_user_id?: string
          event_id?: string
          id?: string
          seats?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_carpools_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_day_pauses: {
        Row: {
          event_id: string
          note: string | null
          paused_at: string
          paused_by: string | null
          reason: string
          student_user_id: string
        }
        Insert: {
          event_id: string
          note?: string | null
          paused_at?: string
          paused_by?: string | null
          reason: string
          student_user_id: string
        }
        Update: {
          event_id?: string
          note?: string | null
          paused_at?: string
          paused_by?: string | null
          reason?: string
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_day_pauses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_maneuvers: {
        Row: {
          event_id: string
          id: string
          sort_order: number
          training_item_id: string
        }
        Insert: {
          event_id: string
          id?: string
          sort_order?: number
          training_item_id: string
        }
        Update: {
          event_id?: string
          id?: string
          sort_order?: number
          training_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_maneuvers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_maneuvers_training_item_id_fkey"
            columns: ["training_item_id"]
            isOneToOne: false
            referencedRelation: "training_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_messages: {
        Row: {
          created_at: string
          event_id: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          storage_path: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          storage_path: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_items: {
        Row: {
          created_at: string
          event_id: string
          id: string
          item_date: string
          item_time: string | null
          location: string | null
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          item_date: string
          item_time?: string | null
          location?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          item_date?: string
          item_time?: string | null
          location?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_program_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_school_flight_items: {
        Row: {
          flight_id: string
          rated_by: string | null
          rating: number
          training_item_id: string
          updated_at: string
        }
        Insert: {
          flight_id: string
          rated_by?: string | null
          rating: number
          training_item_id: string
          updated_at?: string
        }
        Update: {
          flight_id?: string
          rated_by?: string | null
          rating?: number
          training_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_school_flight_items_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "event_school_flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_school_flight_items_training_item_id_fkey"
            columns: ["training_item_id"]
            isOneToOne: false
            referencedRelation: "training_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_school_flight_notes: {
        Row: {
          feedback: string | null
          flight_id: string
          internal_note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          feedback?: string | null
          flight_id: string
          internal_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          feedback?: string | null
          flight_id?: string
          internal_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_school_flight_notes_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: true
            referencedRelation: "event_school_flights"
            referencedColumns: ["id"]
          },
        ]
      }
      event_school_flights: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          group_id: string
          id: string
          landed_at: string | null
          landed_by: string | null
          landing_location_id: string | null
          logbook_flight_id: string | null
          seq: number
          start_note: string | null
          started_at: string | null
          status: string
          student_user_id: string
          takeoff_location_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          group_id: string
          id?: string
          landed_at?: string | null
          landed_by?: string | null
          landing_location_id?: string | null
          logbook_flight_id?: string | null
          seq: number
          start_note?: string | null
          started_at?: string | null
          status: string
          student_user_id: string
          takeoff_location_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          group_id?: string
          id?: string
          landed_at?: string | null
          landed_by?: string | null
          landing_location_id?: string | null
          logbook_flight_id?: string | null
          seq?: number
          start_note?: string | null
          started_at?: string | null
          status?: string
          student_user_id?: string
          takeoff_location_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_school_flights_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_school_flights_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_school_flights_landing_location_id_fkey"
            columns: ["landing_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_school_flights_logbook_flight_id_fkey"
            columns: ["logbook_flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_school_flights_takeoff_location_id_fkey"
            columns: ["takeoff_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_signups: {
        Row: {
          attended: boolean | null
          checked_in_at: string | null
          confirmed_by_school: boolean
          event_id: string
          id: string
          presence: string
          signed_up: boolean
          status: string
          updated_at: string
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          attended?: boolean | null
          checked_in_at?: string | null
          confirmed_by_school?: boolean
          event_id: string
          id?: string
          presence?: string
          signed_up?: boolean
          status?: string
          updated_at?: string
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          attended?: boolean | null
          checked_in_at?: string | null
          confirmed_by_school?: boolean
          event_id?: string
          id?: string
          presence?: string
          signed_up?: boolean
          status?: string
          updated_at?: string
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_signups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          created_at: string
          event_id: string
          id: string
          position: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          position?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          position?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_weather_decisions: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_deadline: string | null
          event_id: string
          id: string
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_deadline?: string | null
          event_id: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_deadline?: string | null
          event_id?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_weather_decisions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_achievements: {
        Row: {
          achievement_type: string
          challenge_id: string
          created_at: string
          goal_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          achievement_type?: string
          challenge_id: string
          created_at?: string
          goal_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          achievement_type?: string
          challenge_id?: string
          created_at?: string
          goal_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_achievements_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_achievements_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "challenge_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          achievement_id: string | null
          created_at: string
          event_id: string | null
          flight_id: string | null
          id: string
          message: string
          user_id: string
        }
        Insert: {
          achievement_id?: string | null
          created_at?: string
          event_id?: string | null
          flight_id?: string | null
          id?: string
          message: string
          user_id: string
        }
        Update: {
          achievement_id?: string | null
          created_at?: string
          event_id?: string | null
          flight_id?: string | null
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "feed_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comments_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_likes: {
        Row: {
          achievement_id: string | null
          created_at: string
          event_id: string | null
          flight_id: string | null
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          achievement_id?: string | null
          created_at?: string
          event_id?: string | null
          flight_id?: string | null
          id?: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          achievement_id?: string | null
          created_at?: string
          event_id?: string | null
          flight_id?: string | null
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "feed_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_likes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_likes_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_coach_notes: {
        Row: {
          coach_id: string
          created_at: string
          flight_id: string
          id: string
          note: string
          updated_at: string
          visible_to_student: boolean
        }
        Insert: {
          coach_id: string
          created_at?: string
          flight_id: string
          id?: string
          note?: string
          updated_at?: string
          visible_to_student?: boolean
        }
        Update: {
          coach_id?: string
          created_at?: string
          flight_id?: string
          id?: string
          note?: string
          updated_at?: string
          visible_to_student?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "flight_coach_notes_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_events: {
        Row: {
          chat_link: string | null
          created_at: string
          created_by: string
          day_closed_at: string | null
          day_closed_by: string | null
          day_topic: string | null
          default_landing_location_id: string | null
          default_takeoff_location_id: string | null
          departure_info: string | null
          description: string | null
          end_date: string | null
          event_category: string
          event_date: string
          event_type: string | null
          feed_description: string | null
          feedback_released_at: string | null
          flight_area: string | null
          flight_prep_notes: string | null
          group_id: string
          id: string
          instructor: string | null
          launch_helper: string | null
          max_participants: number | null
          meeting_point: string | null
          published_at: string | null
          published_to_feed: boolean
          series_id: string | null
          signup_deadline: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
        }
        Insert: {
          chat_link?: string | null
          created_at?: string
          created_by: string
          day_closed_at?: string | null
          day_closed_by?: string | null
          day_topic?: string | null
          default_landing_location_id?: string | null
          default_takeoff_location_id?: string | null
          departure_info?: string | null
          description?: string | null
          end_date?: string | null
          event_category?: string
          event_date: string
          event_type?: string | null
          feed_description?: string | null
          feedback_released_at?: string | null
          flight_area?: string | null
          flight_prep_notes?: string | null
          group_id: string
          id?: string
          instructor?: string | null
          launch_helper?: string | null
          max_participants?: number | null
          meeting_point?: string | null
          published_at?: string | null
          published_to_feed?: boolean
          series_id?: string | null
          signup_deadline?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
        }
        Update: {
          chat_link?: string | null
          created_at?: string
          created_by?: string
          day_closed_at?: string | null
          day_closed_by?: string | null
          day_topic?: string | null
          default_landing_location_id?: string | null
          default_takeoff_location_id?: string | null
          departure_info?: string | null
          description?: string | null
          end_date?: string | null
          event_category?: string
          event_date?: string
          event_type?: string | null
          feed_description?: string | null
          feedback_released_at?: string | null
          flight_area?: string | null
          flight_prep_notes?: string | null
          group_id?: string
          id?: string
          instructor?: string | null
          launch_helper?: string | null
          max_participants?: number | null
          meeting_point?: string | null
          published_at?: string | null
          published_to_feed?: boolean
          series_id?: string | null
          signup_deadline?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_events_default_landing_location_id_fkey"
            columns: ["default_landing_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_events_default_takeoff_location_id_fkey"
            columns: ["default_takeoff_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_photos: {
        Row: {
          created_at: string
          flight_id: string
          id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_photos_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_templates: {
        Row: {
          created_at: string
          glider: string | null
          group_id: string | null
          id: string
          landing_location_id: string | null
          name: string
          takeoff_location_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          glider?: string | null
          group_id?: string | null
          id?: string
          landing_location_id?: string | null
          name: string
          takeoff_location_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          glider?: string | null
          group_id?: string | null
          id?: string
          landing_location_id?: string | null
          name?: string
          takeoff_location_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_templates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_templates_landing_location_id_fkey"
            columns: ["landing_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_templates_takeoff_location_id_fkey"
            columns: ["takeoff_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_training_items: {
        Row: {
          flight_id: string
          instructor_id: string | null
          instructor_note: string | null
          instructor_rating: number | null
          item_id: string
        }
        Insert: {
          flight_id: string
          instructor_id?: string | null
          instructor_note?: string | null
          instructor_rating?: number | null
          item_id: string
        }
        Update: {
          flight_id?: string
          instructor_id?: string | null
          instructor_note?: string | null
          instructor_rating?: number | null
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_training_items_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_training_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "training_items"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          flight_id: string
          id: string
          poster_path: string | null
          size_bytes: number | null
          storage_path: string | null
          youtube_url: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          flight_id: string
          id?: string
          poster_path?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          youtube_url?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          flight_id?: string
          id?: string
          poster_path?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_videos_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      flights: {
        Row: {
          altitude_gain: number | null
          comments: string | null
          created_at: string
          date: string
          distance_km: number | null
          duration_minutes: number | null
          event_id: string | null
          feed_photo_ids: Json | null
          glider: string | null
          group_id: string | null
          id: string
          is_solo_shv: boolean
          landing_location_id: string | null
          published_at: string | null
          published_to_feed: boolean
          share_token: string | null
          tags: string[] | null
          takeoff_location_id: string | null
          thermals: string | null
          updated_at: string
          user_id: string
          wind_direction: string | null
          wind_speed: number | null
        }
        Insert: {
          altitude_gain?: number | null
          comments?: string | null
          created_at?: string
          date?: string
          distance_km?: number | null
          duration_minutes?: number | null
          event_id?: string | null
          feed_photo_ids?: Json | null
          glider?: string | null
          group_id?: string | null
          id?: string
          is_solo_shv?: boolean
          landing_location_id?: string | null
          published_at?: string | null
          published_to_feed?: boolean
          share_token?: string | null
          tags?: string[] | null
          takeoff_location_id?: string | null
          thermals?: string | null
          updated_at?: string
          user_id: string
          wind_direction?: string | null
          wind_speed?: number | null
        }
        Update: {
          altitude_gain?: number | null
          comments?: string | null
          created_at?: string
          date?: string
          distance_km?: number | null
          duration_minutes?: number | null
          event_id?: string | null
          feed_photo_ids?: Json | null
          glider?: string | null
          group_id?: string | null
          id?: string
          is_solo_shv?: boolean
          landing_location_id?: string | null
          published_at?: string | null
          published_to_feed?: boolean
          share_token?: string | null
          tags?: string[] | null
          takeoff_location_id?: string | null
          thermals?: string | null
          updated_at?: string
          user_id?: string
          wind_direction?: string | null
          wind_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flights_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_landing_location_id_fkey"
            columns: ["landing_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_takeoff_location_id_fkey"
            columns: ["takeoff_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      group_member_functions: {
        Row: {
          created_at: string
          function: Database["public"]["Enums"]["group_function"]
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function: Database["public"]["Enums"]["group_function"]
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function?: Database["public"]["Enums"]["group_function"]
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_member_functions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          attachment_path: string | null
          created_at: string
          group_id: string
          id: string
          is_announcement: boolean
          is_team_only: boolean
          message: string
          requires_confirmation: boolean
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          group_id: string
          id?: string
          is_announcement?: boolean
          is_team_only?: boolean
          message?: string
          requires_confirmation?: boolean
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          group_id?: string
          id?: string
          is_announcement?: boolean
          is_team_only?: boolean
          message?: string
          requires_confirmation?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          group_type: Database["public"]["Enums"]["group_type"]
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          group_type?: Database["public"]["Enums"]["group_type"]
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          group_type?: Database["public"]["Enums"]["group_type"]
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      hidden_events: {
        Row: {
          event_id: string
          hidden_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          hidden_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          hidden_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      igc_tracks: {
        Row: {
          created_at: string
          flight_id: string
          id: string
          storage_path: string
          track_data: Json | null
          track_thumbnail: Json
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          storage_path: string
          track_data?: Json | null
          track_thumbnail?: Json
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          storage_path?: string
          track_data?: Json | null
          track_thumbnail?: Json
        }
        Relationships: [
          {
            foreignKeyName: "igc_tracks_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          created_at: string
          description: string
          event_id: string | null
          flight_id: string | null
          group_id: string
          id: string
          involved_persons: string | null
          measures: string | null
          occurred_at: string
          reported_by: string
          shv_deadline: string | null
          status: string
          student_user_id: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          event_id?: string | null
          flight_id?: string | null
          group_id: string
          id?: string
          involved_persons?: string | null
          measures?: string | null
          occurred_at: string
          reported_by?: string
          shv_deadline?: string | null
          status?: string
          student_user_id?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          event_id?: string | null
          flight_id?: string | null
          group_id?: string
          id?: string
          involved_persons?: string | null
          measures?: string | null
          occurred_at?: string
          reported_by?: string
          shv_deadline?: string | null
          status?: string
          student_user_id?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_availability: {
        Row: {
          created_at: string
          date: string
          group_id: string
          id: string
          note: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          group_id: string
          id?: string
          note?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          group_id?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_availability_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_certifications: {
        Row: {
          cert_type: string
          created_at: string
          group_id: string
          id: string
          issued_at: string | null
          note: string | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          cert_type: string
          created_at?: string
          group_id: string
          id?: string
          issued_at?: string | null
          note?: string | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          cert_type?: string
          created_at?: string
          group_id?: string
          id?: string
          issued_at?: string | null
          note?: string | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_certifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_leader_credits: {
        Row: {
          amount: number
          booking_date: string
          created_at: string
          created_by: string
          days: number
          entry_type: string
          event_id: string | null
          group_id: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          booking_date?: string
          created_at?: string
          created_by: string
          days?: number
          entry_type?: string
          event_id?: string | null
          group_id: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_date?: string
          created_at?: string
          created_by?: string
          days?: number
          entry_type?: string
          event_id?: string | null
          group_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_leader_credits_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_leader_credits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          altitude: number | null
          country_code: string | null
          created_at: string
          description: string | null
          id: string
          latitude: number
          longitude: number
          name: string
          optimal_wind_directions: string[]
          type: Database["public"]["Enums"]["location_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          altitude?: number | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
          optimal_wind_directions?: string[]
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          altitude?: number | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          optimal_wind_directions?: string[]
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_bans: {
        Row: {
          created_at: string
          created_by: string | null
          reason: string | null
          until: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          until?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      marketplace_favorites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listing_photos: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          path: string
          position: number
          thumb_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          path: string
          position: number
          thumb_path: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          path?: string
          position?: number
          thumb_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          attributes: Json
          bumped_at: string | null
          canton: string | null
          category: string
          condition: string | null
          created_at: string
          created_by: string | null
          delivery: string
          description: string
          expires_at: string | null
          expiry_reminded_at: string | null
          featured_until: string | null
          id: string
          lat: number | null
          listing_type: string
          lng: number | null
          locality: string | null
          manufacturer: string | null
          model: string | null
          postal_code: string | null
          price_cents: number | null
          price_type: string
          published_at: string | null
          quantity: number
          removed_at: string | null
          removed_from_status: string | null
          removed_reason: string | null
          school_equipment_id: string | null
          search_vector: unknown
          seller_group_id: string | null
          seller_user_id: string | null
          share_token: string
          size: string | null
          sold_to: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
          year: number | null
        }
        Insert: {
          attributes?: Json
          bumped_at?: string | null
          canton?: string | null
          category: string
          condition?: string | null
          created_at?: string
          created_by?: string | null
          delivery?: string
          description?: string
          expires_at?: string | null
          expiry_reminded_at?: string | null
          featured_until?: string | null
          id?: string
          lat?: number | null
          listing_type?: string
          lng?: number | null
          locality?: string | null
          manufacturer?: string | null
          model?: string | null
          postal_code?: string | null
          price_cents?: number | null
          price_type?: string
          published_at?: string | null
          quantity?: number
          removed_at?: string | null
          removed_from_status?: string | null
          removed_reason?: string | null
          school_equipment_id?: string | null
          search_vector?: unknown
          seller_group_id?: string | null
          seller_user_id?: string | null
          share_token?: string
          size?: string | null
          sold_to?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility?: string
          year?: number | null
        }
        Update: {
          attributes?: Json
          bumped_at?: string | null
          canton?: string | null
          category?: string
          condition?: string | null
          created_at?: string
          created_by?: string | null
          delivery?: string
          description?: string
          expires_at?: string | null
          expiry_reminded_at?: string | null
          featured_until?: string | null
          id?: string
          lat?: number | null
          listing_type?: string
          lng?: number | null
          locality?: string | null
          manufacturer?: string | null
          model?: string | null
          postal_code?: string | null
          price_cents?: number | null
          price_type?: string
          published_at?: string | null
          quantity?: number
          removed_at?: string | null
          removed_from_status?: string | null
          removed_reason?: string | null
          school_equipment_id?: string | null
          search_vector?: unknown
          seller_group_id?: string | null
          seller_user_id?: string | null
          share_token?: string
          size?: string | null
          sold_to?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_school_equipment_id_fkey"
            columns: ["school_equipment_id"]
            isOneToOne: false
            referencedRelation: "school_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_group_id_fkey"
            columns: ["seller_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_moderation_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          listing_id: string | null
          listing_title: string | null
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          listing_title?: string | null
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          listing_title?: string | null
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_moderation_log_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_moderator_push: {
        Row: {
          last_pushed_at: string
          user_id: string
        }
        Insert: {
          last_pushed_at: string
          user_id: string
        }
        Update: {
          last_pushed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_reports: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          listing_id: string
          note: string | null
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          listing_id: string
          note?: string | null
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          listing_id?: string
          note?: string | null
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_reviews: {
        Row: {
          comment: string | null
          created_at: string
          direction: string
          hidden: boolean
          id: string
          listing_id: string | null
          listing_title: string
          rating: number
          reported_at: string | null
          reviewee_group_id: string | null
          reviewee_user_id: string | null
          reviewer_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          direction: string
          hidden?: boolean
          id?: string
          listing_id?: string | null
          listing_title: string
          rating: number
          reported_at?: string | null
          reviewee_group_id?: string | null
          reviewee_user_id?: string | null
          reviewer_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          direction?: string
          hidden?: boolean
          id?: string
          listing_id?: string | null
          listing_title?: string
          rating?: number
          reported_at?: string | null
          reviewee_group_id?: string | null
          reviewee_user_id?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_reviewee_group_id_fkey"
            columns: ["reviewee_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          last_notified_at: string | null
          last_viewed_at: string
          name: string
          notify: boolean
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          id?: string
          last_notified_at?: string | null
          last_viewed_at?: string
          name: string
          notify?: boolean
          query?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          last_notified_at?: string | null
          last_viewed_at?: string
          name?: string
          notify?: boolean
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_terms_acceptances: {
        Row: {
          accepted_at: string
          user_id: string
          version: number
        }
        Insert: {
          accepted_at?: string
          user_id: string
          version: number
        }
        Update: {
          accepted_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          read: boolean
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_badges: {
        Row: {
          badge_key: string
          id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          badge_key: string
          id?: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          badge_key?: string
          id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pilot_gliders: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          last_check_date: string | null
          manufacturer: string
          model: string
          next_check_date: string | null
          reserve_repack_date: string | null
          size: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          last_check_date?: string | null
          manufacturer: string
          model: string
          next_check_date?: string | null
          reserve_repack_date?: string | null
          size?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          last_check_date?: string | null
          manufacturer?: string
          model?: string
          next_check_date?: string | null
          reserve_repack_date?: string | null
          size?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pilot_goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          season_year: number
          target_value: number
          title: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type?: string
          id?: string
          season_year?: number
          target_value?: number
          title: string
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          season_year?: number
          target_value?: number
          title?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_xp: {
        Row: {
          id: string
          level: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          level?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          level?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_photos: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergies: string | null
          avatar_url: string | null
          bio: string | null
          blood_type: string | null
          cover_photo_url: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          exam_practical_date: string | null
          exam_theory_date: string | null
          flight_school: string | null
          glider_info: string | null
          health_data_consent_at: string | null
          id: string
          medical_notes: string | null
          pilot_name: string | null
          shv_number: string | null
          training_level: string | null
          updated_at: string
          user_id: string
          xcontest_password_encrypted: string | null
          xcontest_username: string | null
        }
        Insert: {
          allergies?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_type?: string | null
          cover_photo_url?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          exam_practical_date?: string | null
          exam_theory_date?: string | null
          flight_school?: string | null
          glider_info?: string | null
          health_data_consent_at?: string | null
          id?: string
          medical_notes?: string | null
          pilot_name?: string | null
          shv_number?: string | null
          training_level?: string | null
          updated_at?: string
          user_id: string
          xcontest_password_encrypted?: string | null
          xcontest_username?: string | null
        }
        Update: {
          allergies?: string | null
          avatar_url?: string | null
          bio?: string | null
          blood_type?: string | null
          cover_photo_url?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          exam_practical_date?: string | null
          exam_theory_date?: string | null
          flight_school?: string | null
          glider_info?: string | null
          health_data_consent_at?: string | null
          id?: string
          medical_notes?: string | null
          pilot_name?: string | null
          shv_number?: string | null
          training_level?: string | null
          updated_at?: string
          user_id?: string
          xcontest_password_encrypted?: string | null
          xcontest_username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      school_equipment: {
        Row: {
          condition: string | null
          created_at: string
          equipment_type: string
          group_id: string
          id: string
          inventory_number: string | null
          last_check_date: string | null
          name: string
          next_check_date: string | null
          notes: string | null
          purchase_date: string | null
          retire_reason: string | null
          retired_at: string | null
          shv_type_approved: boolean
          size: string | null
          status: string
          updated_at: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          equipment_type?: string
          group_id: string
          id?: string
          inventory_number?: string | null
          last_check_date?: string | null
          name: string
          next_check_date?: string | null
          notes?: string | null
          purchase_date?: string | null
          retire_reason?: string | null
          retired_at?: string | null
          shv_type_approved?: boolean
          size?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          equipment_type?: string
          group_id?: string
          id?: string
          inventory_number?: string | null
          last_check_date?: string | null
          name?: string
          next_check_date?: string | null
          notes?: string | null
          purchase_date?: string | null
          retire_reason?: string | null
          retired_at?: string | null
          shv_type_approved?: boolean
          size?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_equipment_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      school_rates: {
        Row: {
          amount: number
          created_at: string
          group_id: string
          id: string
          label: string
          rate_key: string
          unit: string
          updated_at: string
          valid_from: string
        }
        Insert: {
          amount?: number
          created_at?: string
          group_id: string
          id?: string
          label: string
          rate_key: string
          unit?: string
          updated_at?: string
          valid_from?: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
          label?: string
          rate_key?: string
          unit?: string
          updated_at?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_rates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      school_shop_profiles: {
        Row: {
          active: boolean
          email: string
          group_id: string
          legal_name: string
          locality: string
          phone: string | null
          postal_code: string
          street: string
          uid_number: string | null
          updated_at: string
          updated_by: string | null
          vat_registered: boolean
          warranty_text: string
        }
        Insert: {
          active?: boolean
          email?: string
          group_id: string
          legal_name?: string
          locality?: string
          phone?: string | null
          postal_code?: string
          street?: string
          uid_number?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_registered?: boolean
          warranty_text?: string
        }
        Update: {
          active?: boolean
          email?: string
          group_id?: string
          legal_name?: string
          locality?: string
          phone?: string | null
          postal_code?: string
          street?: string
          uid_number?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_registered?: boolean
          warranty_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_shop_profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      student_day_notes: {
        Row: {
          created_at: string
          event_id: string
          flight_number: number | null
          id: string
          instructor_id: string | null
          is_next_step: boolean
          note: string
          student_user_id: string
          updated_at: string
          visible_to_student: boolean
        }
        Insert: {
          created_at?: string
          event_id: string
          flight_number?: number | null
          id?: string
          instructor_id?: string | null
          is_next_step?: boolean
          note?: string
          student_user_id: string
          updated_at?: string
          visible_to_student?: boolean
        }
        Update: {
          created_at?: string
          event_id?: string
          flight_number?: number | null
          id?: string
          instructor_id?: string | null
          is_next_step?: boolean
          note?: string
          student_user_id?: string
          updated_at?: string
          visible_to_student?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_day_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "flight_events"
            referencedColumns: ["id"]
          },
        ]
      }
      student_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          group_id: string
          id: string
          reason: string | null
          status: string
          student_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string
          group_id: string
          id?: string
          reason?: string | null
          status: string
          student_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          group_id?: string
          id?: string
          reason?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_status_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      team_poll_responses: {
        Row: {
          id: string
          poll_id: string
          responded_at: string
          response: string
          user_id: string
        }
        Insert: {
          id?: string
          poll_id: string
          responded_at?: string
          response: string
          user_id: string
        }
        Update: {
          id?: string
          poll_id?: string
          responded_at?: string
          response?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "team_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      team_polls: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          options: string[]
          question: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          options?: string[]
          question: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          options?: string[]
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      training_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          training_level: string | null
          unlocks_after_category_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          training_level?: string | null
          unlocks_after_category_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          training_level?: string | null
          unlocks_after_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_categories_unlocks_after_category_id_fkey"
            columns: ["unlocks_after_category_id"]
            isOneToOne: false
            referencedRelation: "training_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      training_items: {
        Row: {
          category_id: string
          content: string | null
          created_at: string
          danger: string | null
          goal: string | null
          id: string
          is_exam_maneuver: boolean
          mistakes: string | null
          name: string
          sort_order: number
        }
        Insert: {
          category_id: string
          content?: string | null
          created_at?: string
          danger?: string | null
          goal?: string | null
          id?: string
          is_exam_maneuver?: boolean
          mistakes?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          content?: string | null
          created_at?: string
          danger?: string | null
          goal?: string | null
          id?: string
          is_exam_maneuver?: boolean
          mistakes?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "training_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      training_level_history: {
        Row: {
          changed_at: string
          changed_by: string
          group_id: string
          id: string
          training_level: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string
          group_id: string
          id?: string
          training_level: string
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          group_id?: string
          id?: string
          training_level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_level_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      training_progress: {
        Row: {
          id: string
          item_id: string
          notes: string | null
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          notes?: string | null
          rating?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          notes?: string | null
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_progress_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "training_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      xcontest_imports: {
        Row: {
          flight_id: string | null
          id: string
          imported_at: string
          user_id: string
          xcontest_flight_url: string
        }
        Insert: {
          flight_id?: string | null
          id?: string
          imported_at?: string
          user_id: string
          xcontest_flight_url: string
        }
        Update: {
          flight_id?: string | null
          id?: string
          imported_at?: string
          user_id?: string
          xcontest_flight_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "xcontest_imports_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_photo_url: string | null
          created_at: string | null
          flight_school: string | null
          glider_info: string | null
          pilot_name: string | null
          training_level: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          flight_school?: string | null
          glider_info?: string | null
          pilot_name?: string | null
          training_level?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          flight_school?: string | null
          glider_info?: string | null
          pilot_name?: string | null
          training_level?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      build_track_thumbnail: { Args: { raw: Json }; Returns: Json }
      chat_can_manage: {
        Args: { _channel: string; _uid: string }
        Returns: boolean
      }
      chat_can_post: {
        Args: { _channel: string; _uid: string }
        Returns: boolean
      }
      chat_can_read: {
        Args: { _channel: string; _uid: string }
        Returns: boolean
      }
      chat_channel_json: { Args: { _channel: string }; Returns: Json }
      chat_channel_readers: {
        Args: { _channel: string }
        Returns: {
          pilot_name: string
          user_id: string
        }[]
      }
      chat_direct_candidates: {
        Args: never
        Returns: {
          groups: string[]
          pilot_name: string
          user_id: string
        }[]
      }
      chat_edit_message: {
        Args: { _mentions?: string[]; _message: string; _text: string }
        Returns: undefined
      }
      chat_event_channel: { Args: { _event: string }; Returns: Json }
      chat_inbox: { Args: never; Returns: Json }
      chat_is_student: {
        Args: { _group: string; _uid: string }
        Returns: boolean
      }
      chat_mark_read: { Args: { _channel: string }; Returns: undefined }
      chat_message_in_channel: {
        Args: { _channel: string; _message: string }
        Returns: boolean
      }
      chat_open_direct: { Args: { _other: string }; Returns: string }
      chat_search: { Args: { _limit?: number; _q: string }; Returns: Json }
      chat_set_notify_level: {
        Args: { _channel: string; _level: string }
        Returns: undefined
      }
      chat_shares_group: { Args: { _a: string; _b: string }; Returns: boolean }
      check_and_award_badges_for_user: {
        Args: { _user_id: string }
        Returns: undefined
      }
      event_detail_data: { Args: { _event_id: string }; Returns: Json }
      feed_achievement_item: { Args: { _id: string }; Returns: Json }
      feed_event_item: { Args: { _id: string }; Returns: Json }
      feed_flight_item: { Args: { _id: string }; Returns: Json }
      feed_mention_members: { Args: never; Returns: Json }
      feed_page: { Args: { _cursor?: string; _limit?: number }; Returns: Json }
      feed_social: { Args: { _id: string; _kind: string }; Returns: Json }
      flight_day_require_signup: {
        Args: { _event_id: string; _student_id: string }
        Returns: undefined
      }
      flight_day_role: {
        Args: { _event_id: string; _user_id: string }
        Returns: string
      }
      get_emergency_contact_info: {
        Args: { _event_id: string; _target_user_id: string }
        Returns: {
          allergies: string
          blood_type: string
          emergency_contact_name: string
          emergency_contact_phone: string
          health_data_consent_at: string
          medical_notes: string
        }[]
      }
      get_group_push_status: {
        Args: { _group_id: string }
        Returns: {
          enabled: boolean
          pilot_name: string
          user_id: string
        }[]
      }
      get_own_profile_private: {
        Args: never
        Returns: {
          allergies: string
          blood_type: string
          emergency_contact_name: string
          emergency_contact_phone: string
          exam_practical_date: string
          exam_theory_date: string
          health_data_consent_at: string
          medical_notes: string
          shv_number: string
          xcontest_password_encrypted: string
          xcontest_username: string
        }[]
      }
      get_pilot_stats: {
        Args: { _user_id: string; _year?: number }
        Returns: {
          total_altitude: number
          total_distance: number
          total_flights: number
          total_minutes: number
          unique_landings: number
          unique_takeoffs: number
        }[]
      }
      get_public_profile: {
        Args: { _user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          cover_photo_url: string
          flight_school: string
          glider_info: string
          pilot_name: string
          training_level: string
          user_id: string
        }[]
      }
      has_group_function: {
        Args: {
          _function: Database["public"]["Enums"]["group_function"]
          _group_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inactive_school_students: { Args: { _group_id: string }; Returns: Json }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_staff: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_team_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_market_banned: { Args: { _uid: string }; Returns: boolean }
      is_market_moderator: { Args: { _uid: string }; Returns: boolean }
      is_market_staff: { Args: { _uid: string }; Returns: boolean }
      is_owner_of_flight: { Args: { _flight_id: string }; Returns: boolean }
      join_group_by_invite_code: {
        Args: { _invite_code: string }
        Returns: {
          already_member: boolean
          id: string
          name: string
        }[]
      }
      list_flights_page: {
        Args: {
          _filter?: string
          _group?: string
          _limit?: number
          _offset?: number
          _search?: string
          _viewer_id?: string
          _year?: number
        }
        Returns: Json
      }
      market_can_admin_shop: {
        Args: { _group: string; _uid: string }
        Returns: boolean
      }
      market_can_manage: {
        Args: { _seller_group: string; _seller_user: string; _uid: string }
        Returns: boolean
      }
      market_can_manage_listing: {
        Args: { _listing: string; _uid: string }
        Returns: boolean
      }
      market_can_moderate: {
        Args: {
          _uid: string
          l: Database["public"]["Tables"]["marketplace_listings"]["Row"]
        }
        Returns: boolean
      }
      market_distance_km: {
        Args: { _lat1: number; _lat2: number; _lng1: number; _lng2: number }
        Returns: number
      }
      market_listing_accepts_photos: {
        Args: { _listing: string }
        Returns: boolean
      }
      market_listing_matches: {
        Args: {
          _filters: Json
          l: Database["public"]["Tables"]["marketplace_listings"]["Row"]
        }
        Returns: boolean
      }
      market_listing_visible: {
        Args: {
          _uid: string
          l: Database["public"]["Tables"]["marketplace_listings"]["Row"]
        }
        Returns: boolean
      }
      market_photo_file_count: { Args: { _listing: string }; Returns: number }
      market_photo_listing: { Args: { _name: string }; Returns: string }
      market_shop_ready: { Args: { _group: string }; Returns: boolean }
      market_terms_accepted: { Args: { _uid: string }; Returns: boolean }
      marketplace_bump: { Args: { _listing: string }; Returns: Json }
      marketplace_chat_buyers: {
        Args: { _listing: string }
        Returns: {
          pilot_name: string
          user_id: string
        }[]
      }
      marketplace_chat_info: { Args: { _channel: string }; Returns: Json }
      marketplace_check_active_limit: {
        Args: { l: Database["public"]["Tables"]["marketplace_listings"]["Row"] }
        Returns: undefined
      }
      marketplace_daily_cleanup: { Args: never; Returns: Json }
      marketplace_expiry: {
        Args: { l: Database["public"]["Tables"]["marketplace_listings"]["Row"] }
        Returns: string
      }
      marketplace_hide: {
        Args: {
          _reason: string
          l: Database["public"]["Tables"]["marketplace_listings"]["Row"]
        }
        Returns: {
          attributes: Json
          bumped_at: string | null
          canton: string | null
          category: string
          condition: string | null
          created_at: string
          created_by: string | null
          delivery: string
          description: string
          expires_at: string | null
          expiry_reminded_at: string | null
          featured_until: string | null
          id: string
          lat: number | null
          listing_type: string
          lng: number | null
          locality: string | null
          manufacturer: string | null
          model: string | null
          postal_code: string | null
          price_cents: number | null
          price_type: string
          published_at: string | null
          quantity: number
          removed_at: string | null
          removed_from_status: string | null
          removed_reason: string | null
          school_equipment_id: string | null
          search_vector: unknown
          seller_group_id: string | null
          seller_user_id: string | null
          share_token: string
          size: string | null
          sold_to: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
          year: number | null
        }
        SetofOptions: {
          from: "*"
          to: "marketplace_listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      marketplace_locked_listing: {
        Args: { _listing: string }
        Returns: {
          attributes: Json
          bumped_at: string | null
          canton: string | null
          category: string
          condition: string | null
          created_at: string
          created_by: string | null
          delivery: string
          description: string
          expires_at: string | null
          expiry_reminded_at: string | null
          featured_until: string | null
          id: string
          lat: number | null
          listing_type: string
          lng: number | null
          locality: string | null
          manufacturer: string | null
          model: string | null
          postal_code: string | null
          price_cents: number | null
          price_type: string
          published_at: string | null
          quantity: number
          removed_at: string | null
          removed_from_status: string | null
          removed_reason: string | null
          school_equipment_id: string | null
          search_vector: unknown
          seller_group_id: string | null
          seller_user_id: string | null
          share_token: string
          size: string | null
          sold_to: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
          year: number | null
        }
        SetofOptions: {
          from: "*"
          to: "marketplace_listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      marketplace_log: {
        Args: {
          _action: string
          _listing: Database["public"]["Tables"]["marketplace_listings"]["Row"]
          _reason: string
          _target: string
        }
        Returns: undefined
      }
      marketplace_mark_sold: { Args: { _listing: string }; Returns: Json }
      marketplace_mark_sold_to: {
        Args: { _buyer: string; _listing: string }
        Returns: Json
      }
      marketplace_moderate: {
        Args: { _action: string; _listing: string; _reason?: string }
        Returns: Json
      }
      marketplace_moderate_review: {
        Args: { _hide: boolean; _review: string }
        Returns: undefined
      }
      marketplace_moderation_queue: { Args: never; Returns: Json }
      marketplace_my_favorites: { Args: never; Returns: Json }
      marketplace_my_shops: {
        Args: never
        Returns: {
          can_admin: boolean
          group_id: string
          name: string
          ready: boolean
        }[]
      }
      marketplace_notify_hidden: {
        Args: { l: Database["public"]["Tables"]["marketplace_listings"]["Row"] }
        Returns: undefined
      }
      marketplace_open_chat: { Args: { _listing: string }; Returns: string }
      marketplace_public_listing: { Args: { _token: string }; Returns: Json }
      marketplace_publish: { Args: { _listing: string }; Returns: Json }
      marketplace_renew: { Args: { _listing: string }; Returns: Json }
      marketplace_reorder_photos: {
        Args: { _listing: string; _photo_ids: string[] }
        Returns: undefined
      }
      marketplace_report: {
        Args: { _listing: string; _note?: string; _reason: string }
        Returns: undefined
      }
      marketplace_report_review: {
        Args: { _review: string }
        Returns: undefined
      }
      marketplace_reported_reviews: { Args: never; Returns: Json }
      marketplace_reserve: {
        Args: { _listing: string; _reserved: boolean }
        Returns: Json
      }
      marketplace_review: {
        Args: { _comment?: string; _listing: string; _rating: number }
        Returns: string
      }
      marketplace_review_state: { Args: { _listing: string }; Returns: string }
      marketplace_reviews_of: {
        Args: { _group: string; _user: string }
        Returns: Json
      }
      marketplace_sale_candidates: {
        Args: { _listing: string }
        Returns: {
          pilot_name: string
          user_id: string
        }[]
      }
      marketplace_saved_searches_overview: { Args: never; Returns: Json }
      marketplace_search: {
        Args: { _cursor?: Json; _filters?: Json; _limit?: number }
        Returns: Json
      }
      marketplace_sell_to_member: {
        Args: { _buyer: string; _listing: string; _price_cents?: number }
        Returns: string
      }
      marketplace_seller_cards: {
        Args: { _listing_ids: string[] }
        Returns: {
          avatar_url: string
          flight_count: number
          listing_id: string
          member_since: string
          name: string
          rating_avg: number
          rating_count: number
          seller_id: string
          seller_kind: string
        }[]
      }
      marketplace_set_ban: {
        Args: {
          _banned: boolean
          _reason?: string
          _until?: string
          _user: string
        }
        Returns: undefined
      }
      marketplace_storage_usage: { Args: never; Returns: Json }
      marketplace_trigger_cleanup: { Args: never; Returns: undefined }
      my_school_flights: { Args: { _event_id: string }; Returns: Json }
      report_client_error: {
        Args: {
          _app_version?: string
          _kind: string
          _message: string
          _path?: string
          _stack?: string
          _user_agent?: string
        }
        Returns: undefined
      }
      school_dashboard_data: {
        Args: { _group_id: string; _section?: string; _viewer_id?: string }
        Returns: Json
      }
      school_flight_abort: {
        Args: { _flight_id: string; _note?: string }
        Returns: {
          created_at: string
          created_by: string | null
          event_id: string
          group_id: string
          id: string
          landed_at: string | null
          landed_by: string | null
          landing_location_id: string | null
          logbook_flight_id: string | null
          seq: number
          start_note: string | null
          started_at: string | null
          status: string
          student_user_id: string
          takeoff_location_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "event_school_flights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      school_flight_add: {
        Args: {
          _event_id: string
          _items?: Json
          _landing_location_id?: string
          _notes?: Json
          _student_id: string
          _takeoff_location_id?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          event_id: string
          group_id: string
          id: string
          landed_at: string | null
          landed_by: string | null
          landing_location_id: string | null
          logbook_flight_id: string | null
          seq: number
          start_note: string | null
          started_at: string | null
          status: string
          student_user_id: string
          takeoff_location_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "event_school_flights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      school_flight_default_location: {
        Args: { _event_id: string; _kind: string }
        Returns: string
      }
      school_flight_delete: { Args: { _flight_id: string }; Returns: undefined }
      school_flight_guard: {
        Args: { _event_id: string; _need: string }
        Returns: {
          chat_link: string | null
          created_at: string
          created_by: string
          day_closed_at: string | null
          day_closed_by: string | null
          day_topic: string | null
          default_landing_location_id: string | null
          default_takeoff_location_id: string | null
          departure_info: string | null
          description: string | null
          end_date: string | null
          event_category: string
          event_date: string
          event_type: string | null
          feed_description: string | null
          feedback_released_at: string | null
          flight_area: string | null
          flight_prep_notes: string | null
          group_id: string
          id: string
          instructor: string | null
          launch_helper: string | null
          max_participants: number | null
          meeting_point: string | null
          published_at: string | null
          published_to_feed: boolean
          series_id: string | null
          signup_deadline: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "flight_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      school_flight_land: {
        Args: {
          _flight_id: string
          _items?: Json
          _landing_location_id?: string
          _notes?: Json
        }
        Returns: {
          created_at: string
          created_by: string | null
          event_id: string
          group_id: string
          id: string
          landed_at: string | null
          landed_by: string | null
          landing_location_id: string | null
          logbook_flight_id: string | null
          seq: number
          start_note: string | null
          started_at: string | null
          status: string
          student_user_id: string
          takeoff_location_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "event_school_flights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      school_flight_next_seq: {
        Args: { _event_id: string; _student_id: string }
        Returns: number
      }
      school_flight_set_items: {
        Args: { _flight_id: string; _items: Json }
        Returns: undefined
      }
      school_flight_set_notes: {
        Args: { _flight_id: string; _patch: Json }
        Returns: undefined
      }
      school_flight_start: {
        Args: {
          _event_id: string
          _note?: string
          _student_id: string
          _takeoff_location_id?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          event_id: string
          group_id: string
          id: string
          landed_at: string | null
          landed_by: string | null
          landing_location_id: string | null
          logbook_flight_id: string | null
          seq: number
          start_note: string | null
          started_at: string | null
          status: string
          student_user_id: string
          takeoff_location_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "event_school_flights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      school_flight_update: {
        Args: { _flight_id: string; _patch: Json }
        Returns: {
          created_at: string
          created_by: string | null
          event_id: string
          group_id: string
          id: string
          landed_at: string | null
          landed_by: string | null
          landing_location_id: string | null
          logbook_flight_id: string | null
          seq: number
          start_note: string | null
          started_at: string | null
          status: string
          student_user_id: string
          takeoff_location_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "event_school_flights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      school_flight_write_items: {
        Args: { _flight_id: string; _items: Json }
        Returns: undefined
      }
      school_flight_write_notes: {
        Args: { _flight_id: string; _patch: Json }
        Returns: undefined
      }
      school_student_dossier: {
        Args: {
          _group_id: string
          _offset?: number
          _section?: string
          _student_id: string
        }
        Returns: Json
      }
      school_student_training_profile: {
        Args: { _group_id: string; _student_id: string }
        Returns: Json
      }
      send_push_notification: {
        Args: { _body: string; _title: string; _url?: string; _user_id: string }
        Returns: undefined
      }
      set_day_pause: {
        Args: {
          _event_id: string
          _note?: string
          _reason: string
          _student_id: string
        }
        Returns: undefined
      }
      set_event_status: {
        Args: {
          _event_id: string
          _status: Database["public"]["Enums"]["event_status"]
        }
        Returns: Database["public"]["Enums"]["event_status"]
      }
      set_flight_day_locations: {
        Args: {
          _event_id: string
          _landing_location_id: string
          _takeoff_location_id: string
        }
        Returns: undefined
      }
      set_member_training_level: {
        Args: { _group_id: string; _training_level: string; _user_id: string }
        Returns: undefined
      }
      set_signup_confirmed: {
        Args: { _confirmed: boolean; _event_id: string; _student_id: string }
        Returns: boolean
      }
      set_signup_presence: {
        Args: { _event_id: string; _presence: string; _student_id: string }
        Returns: string
      }
      set_signups_present: {
        Args: { _event_id: string; _student_ids: string[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      event_status: "announced" | "confirmed" | "cancelled"
      group_function:
        | "student"
        | "licensed"
        | "launch_helper"
        | "instructor"
        | "school_lead"
        | "shop"
        | "market_moderator"
      group_role: "admin" | "member"
      group_type: "school" | "pilot_group"
      location_type: "takeoff" | "landing" | "both"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      event_status: ["announced", "confirmed", "cancelled"],
      group_function: [
        "student",
        "licensed",
        "launch_helper",
        "instructor",
        "school_lead",
        "shop",
        "market_moderator",
      ],
      group_role: ["admin", "member"],
      group_type: ["school", "pilot_group"],
      location_type: ["takeoff", "landing", "both"],
    },
  },
} as const
