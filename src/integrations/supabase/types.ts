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
      event_signups: {
        Row: {
          attended: boolean
          confirmed_by_school: boolean
          event_id: string
          id: string
          signed_up: boolean
          status: string
          updated_at: string
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          attended?: boolean
          confirmed_by_school?: boolean
          event_id: string
          id?: string
          signed_up?: boolean
          status?: string
          updated_at?: string
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          attended?: boolean
          confirmed_by_school?: boolean
          event_id?: string
          id?: string
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
          day_topic: string | null
          departure_info: string | null
          description: string | null
          end_date: string | null
          event_category: string
          event_date: string
          event_type: string | null
          feed_description: string | null
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
          day_topic?: string | null
          departure_info?: string | null
          description?: string | null
          end_date?: string | null
          event_category?: string
          event_date: string
          event_type?: string | null
          feed_description?: string | null
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
          day_topic?: string | null
          departure_info?: string | null
          description?: string | null
          end_date?: string | null
          event_category?: string
          event_date?: string
          event_type?: string | null
          feed_description?: string | null
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
          message: string
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          group_id: string
          id?: string
          is_announcement?: boolean
          message?: string
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          group_id?: string
          id?: string
          is_announcement?: boolean
          message?: string
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
      student_day_notes: {
        Row: {
          created_at: string
          event_id: string
          flight_number: number | null
          id: string
          instructor_id: string | null
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
      training_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          training_level: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          training_level?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          training_level?: string | null
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
      check_and_award_badges_for_user: {
        Args: { _user_id: string }
        Returns: undefined
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
      is_owner_of_flight: { Args: { _flight_id: string }; Returns: boolean }
      join_group_by_invite_code: {
        Args: { _invite_code: string }
        Returns: {
          already_member: boolean
          id: string
          name: string
        }[]
      }
      send_push_notification: {
        Args: { _body: string; _title: string; _url?: string; _user_id: string }
        Returns: undefined
      }
      set_member_training_level: {
        Args: { _group_id: string; _training_level: string; _user_id: string }
        Returns: undefined
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
      ],
      group_role: ["admin", "member"],
      group_type: ["school", "pilot_group"],
      location_type: ["takeoff", "landing", "both"],
    },
  },
} as const
