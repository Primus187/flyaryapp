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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
      event_signups: {
        Row: {
          event_id: string
          id: string
          signed_up: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          signed_up?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          signed_up?: boolean
          updated_at?: string
          user_id?: string
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
      feed_comments: {
        Row: {
          created_at: string
          flight_id: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string
          flight_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_flight_id_fkey"
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
          description: string | null
          event_date: string
          event_type: string | null
          group_id: string
          id: string
          instructor: string | null
          launch_helper: string | null
          max_participants: number | null
          meeting_point: string | null
          signup_deadline: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
        }
        Insert: {
          chat_link?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_type?: string | null
          group_id: string
          id?: string
          instructor?: string | null
          launch_helper?: string | null
          max_participants?: number | null
          meeting_point?: string | null
          signup_deadline?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
        }
        Update: {
          chat_link?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_type?: string | null
          group_id?: string
          id?: string
          instructor?: string | null
          launch_helper?: string | null
          max_participants?: number | null
          meeting_point?: string | null
          signup_deadline?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
        }
        Relationships: [
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
      flight_training_items: {
        Row: {
          flight_id: string
          item_id: string
        }
        Insert: {
          flight_id: string
          item_id: string
        }
        Update: {
          flight_id?: string
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
          flight_id: string
          id: string
          youtube_url: string
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          youtube_url: string
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          youtube_url?: string
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
          glider: string | null
          group_id: string | null
          id: string
          is_solo_shv: boolean
          landing_location_id: string | null
          published_to_feed: boolean
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
          glider?: string | null
          group_id?: string | null
          id?: string
          is_solo_shv?: boolean
          landing_location_id?: string | null
          published_to_feed?: boolean
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
          glider?: string | null
          group_id?: string | null
          id?: string
          is_solo_shv?: boolean
          landing_location_id?: string | null
          published_to_feed?: boolean
          takeoff_location_id?: string | null
          thermals?: string | null
          updated_at?: string
          user_id?: string
          wind_direction?: string | null
          wind_speed?: number | null
        }
        Relationships: [
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
      igc_tracks: {
        Row: {
          created_at: string
          flight_id: string
          id: string
          storage_path: string
          track_data: Json | null
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          storage_path: string
          track_data?: Json | null
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          storage_path?: string
          track_data?: Json | null
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
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pilot_gliders: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          manufacturer: string
          model: string
          size: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          manufacturer: string
          model: string
          size?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          manufacturer?: string
          model?: string
          size?: string | null
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
      profiles: {
        Row: {
          allergies: string | null
          avatar_url: string | null
          bio: string | null
          blood_type: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          exam_practical_date: string | null
          exam_theory_date: string | null
          flight_school: string | null
          glider_info: string | null
          id: string
          medical_notes: string | null
          pilot_name: string | null
          shv_number: string | null
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
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          exam_practical_date?: string | null
          exam_theory_date?: string | null
          flight_school?: string | null
          glider_info?: string | null
          id?: string
          medical_notes?: string | null
          pilot_name?: string | null
          shv_number?: string | null
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
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          exam_practical_date?: string | null
          exam_theory_date?: string | null
          flight_school?: string | null
          glider_info?: string | null
          id?: string
          medical_notes?: string | null
          pilot_name?: string | null
          shv_number?: string | null
          updated_at?: string
          user_id?: string
          xcontest_password_encrypted?: string | null
          xcontest_username?: string | null
        }
        Relationships: []
      }
      training_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      training_items: {
        Row: {
          category_id: string
          content: string | null
          created_at: string
          danger: string | null
          goal: string | null
          id: string
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner_of_flight: { Args: { _flight_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      event_status: "announced" | "confirmed" | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      group_role: ["admin", "member"],
      group_type: ["school", "pilot_group"],
      location_type: ["takeoff", "landing", "both"],
    },
  },
} as const
