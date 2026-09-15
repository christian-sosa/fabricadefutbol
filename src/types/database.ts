export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          admin_id: string | null;
          club_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          event_name: string;
          id: string;
          league_id: string | null;
          organization_id: string | null;
          path: string | null;
          properties: Json;
          source: string;
        };
        Insert: {
          admin_id?: string | null;
          club_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          event_name: string;
          id?: string;
          league_id?: string | null;
          organization_id?: string | null;
          path?: string | null;
          properties?: Json;
          source?: string;
        };
        Update: {
          admin_id?: string | null;
          club_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          event_name?: string;
          id?: string;
          league_id?: string | null;
          organization_id?: string | null;
          path?: string | null;
          properties?: Json;
          source?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          image_path: string | null;
          is_public: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          is_public?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          is_public?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          active: boolean;
          created_at: string;
          current_rating: number;
          display_order: number;
          full_name: string;
          photo_path?: string | null;
          photo_updated_at?: string | null;
          id: string;
          initial_rank: number;
          notes: string | null;
          organization_id: string;
          skill_level: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          current_rating?: number;
          display_order?: number;
          full_name: string;
          photo_path?: string | null;
          photo_updated_at?: string | null;
          id?: string;
          initial_rank: number;
          notes?: string | null;
          organization_id: string;
          skill_level?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          current_rating?: number;
          display_order?: number;
          full_name?: string;
          photo_path?: string | null;
          photo_updated_at?: string | null;
          id?: string;
          initial_rank?: number;
          notes?: string | null;
          organization_id?: string;
          skill_level?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_seasons: {
        Row: {
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          duration_months: number;
          ends_at: string;
          id: string;
          label: string;
          organization_id: string;
          starts_at: string;
          status: "active" | "closed";
          updated_at: string;
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_months?: number;
          ends_at: string;
          id?: string;
          label: string;
          organization_id: string;
          starts_at: string;
          status?: "active" | "closed";
          updated_at?: string;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_months?: number;
          ends_at?: string;
          id?: string;
          label?: string;
          organization_id?: string;
          starts_at?: string;
          status?: "active" | "closed";
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_season_player_ratings: {
        Row: {
          created_at: string;
          current_rating: number;
          id: string;
          organization_id: string;
          player_id: string;
          season_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_rating?: number;
          id?: string;
          organization_id: string;
          player_id: string;
          season_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_rating?: number;
          id?: string;
          organization_id?: string;
          player_id?: string;
          season_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          confirmed_option_id: string | null;
          created_at: string;
          created_by: string;
          finished_at: string | null;
          goalkeeper_player_ids: string[];
          result_version: number;
          formation_data: Json | null;
          formation_version: number;
          lineup_snapshot: Json;
          id: string;
          location: string | null;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "10v10" | "11v11";
          organization_id: string;
          scheduled_at: string;
          season_id: string | null;
          status: "draft" | "confirmed" | "finished" | "cancelled";
          team_a_label: string | null;
          team_b_label: string | null;
          updated_at: string;
        };
        Insert: {
          confirmed_option_id?: string | null;
          created_at?: string;
          created_by: string;
          finished_at?: string | null;
          goalkeeper_player_ids?: string[];
          result_version?: number;
          formation_data?: Json | null;
          formation_version?: number;
          lineup_snapshot?: Json;
          id?: string;
          location?: string | null;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "10v10" | "11v11";
          organization_id: string;
          scheduled_at: string;
          season_id?: string | null;
          status?: "draft" | "confirmed" | "finished" | "cancelled";
          team_a_label?: string | null;
          team_b_label?: string | null;
          updated_at?: string;
        };
        Update: {
          confirmed_option_id?: string | null;
          created_at?: string;
          created_by?: string;
          finished_at?: string | null;
          goalkeeper_player_ids?: string[];
          result_version?: number;
          formation_data?: Json | null;
          formation_version?: number;
          lineup_snapshot?: Json;
          id?: string;
          location?: string | null;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "10v10" | "11v11";
          organization_id?: string;
          scheduled_at?: string;
          season_id?: string | null;
          status?: "draft" | "confirmed" | "finished" | "cancelled";
          team_a_label?: string | null;
          team_b_label?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      match_players: {
        Row: {
          created_at: string;
          id: string;
          match_id: string;
          player_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          match_id: string;
          player_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          match_id?: string;
          player_id?: string;
        };
        Relationships: [];
      };
      match_guests: {
        Row: {
          created_at: string;
          guest_name: string;
          guest_rating: number;
          id: string;
          match_id: string;
        };
        Insert: {
          created_at?: string;
          guest_name: string;
          guest_rating: number;
          id?: string;
          match_id: string;
        };
        Update: {
          created_at?: string;
          guest_name?: string;
          guest_rating?: number;
          id?: string;
          match_id?: string;
        };
        Relationships: [];
      };
      team_options: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          is_confirmed: boolean;
          match_id: string;
          option_number: number;
          rating_diff: number;
          rating_sum_a: number;
          rating_sum_b: number;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          is_confirmed?: boolean;
          match_id: string;
          option_number: number;
          rating_diff: number;
          rating_sum_a: number;
          rating_sum_b: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          is_confirmed?: boolean;
          match_id?: string;
          option_number?: number;
          rating_diff?: number;
          rating_sum_a?: number;
          rating_sum_b?: number;
        };
        Relationships: [];
      };
      team_option_players: {
        Row: {
          created_at: string;
          id: string;
          player_id: string;
          team: "A" | "B";
          team_option_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          player_id: string;
          team: "A" | "B";
          team_option_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          player_id?: string;
          team?: "A" | "B";
          team_option_id?: string;
        };
        Relationships: [];
      };
      team_option_guests: {
        Row: {
          created_at: string;
          guest_id: string;
          id: string;
          team: "A" | "B";
          team_option_id: string;
        };
        Insert: {
          created_at?: string;
          guest_id: string;
          id?: string;
          team: "A" | "B";
          team_option_id: string;
        };
        Update: {
          created_at?: string;
          guest_id?: string;
          id?: string;
          team?: "A" | "B";
          team_option_id?: string;
        };
        Relationships: [];
      };
      match_result: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          match_id: string;
          mvp_display_name: string | null;
          mvp_guest_id: string | null;
          mvp_player_id: string | null;
          notes: string | null;
          handicap_team: "A" | "B" | null;
          score_a: number;
          score_b: number;
          updated_at: string;
          winner_team: "A" | "B" | "DRAW";
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          match_id: string;
          mvp_display_name?: string | null;
          mvp_guest_id?: string | null;
          mvp_player_id?: string | null;
          notes?: string | null;
          handicap_team?: "A" | "B" | null;
          score_a: number;
          score_b: number;
          updated_at?: string;
          winner_team: "A" | "B" | "DRAW";
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          match_id?: string;
          mvp_display_name?: string | null;
          mvp_guest_id?: string | null;
          mvp_player_id?: string | null;
          notes?: string | null;
          handicap_team?: "A" | "B" | null;
          score_a?: number;
          score_b?: number;
          updated_at?: string;
          winner_team?: "A" | "B" | "DRAW";
        };
        Relationships: [];
      };
      rating_history: {
        Row: {
          created_at: string;
          delta: number;
          id: string;
          match_id: string;
          player_id: string;
          rating_after: number;
          rating_before: number;
          reason: string;
          season_delta: number | null;
          season_id: string | null;
          season_rating_after: number | null;
          season_rating_before: number | null;
        };
        Insert: {
          created_at?: string;
          delta: number;
          id?: string;
          match_id: string;
          player_id: string;
          rating_after: number;
          rating_before: number;
          reason?: string;
          season_delta?: number | null;
          season_id?: string | null;
          season_rating_after?: number | null;
          season_rating_before?: number | null;
        };
        Update: {
          created_at?: string;
          delta?: number;
          id?: string;
          match_id?: string;
          player_id?: string;
          rating_after?: number;
          rating_before?: number;
          reason?: string;
          season_delta?: number | null;
          season_id?: string | null;
          season_rating_after?: number | null;
          season_rating_before?: number | null;
        };
        Relationships: [];
      };
      match_player_stats: {
        Row: {
          assists: number;
          created_at: string;
          goals: number;
          id: string;
          match_id: string;
          player_id: string;
          updated_at: string;
        };
        Insert: {
          assists?: number;
          created_at?: string;
          goals?: number;
          id?: string;
          match_id: string;
          player_id: string;
          updated_at?: string;
        };
        Update: {
          assists?: number;
          created_at?: string;
          goals?: number;
          id?: string;
          match_id?: string;
          player_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_match_cards: {
        Row: {
          id: string | null;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "10v10" | "11v11" | null;
          scheduled_at: string | null;
          status: "draft" | "confirmed" | "finished" | "cancelled" | null;
          team_a_label: string | null;
          team_b_label: string | null;
          team_a_players: string[] | null;
          team_b_players: string[] | null;
          score_a: number | null;
          score_b: number | null;
          winner_team: "A" | "B" | "DRAW" | null;
        };
        Insert: {
          id?: string | null;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "10v10" | "11v11" | null;
          scheduled_at?: string | null;
          status?: "draft" | "confirmed" | "finished" | "cancelled" | null;
          team_a_label?: string | null;
          team_b_label?: string | null;
          team_a_players?: string[] | null;
          team_b_players?: string[] | null;
          score_a?: number | null;
          score_b?: number | null;
          winner_team?: "A" | "B" | "DRAW" | null;
        };
        Update: {
          id?: string | null;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "10v10" | "11v11" | null;
          scheduled_at?: string | null;
          status?: "draft" | "confirmed" | "finished" | "cancelled" | null;
          team_a_label?: string | null;
          team_b_label?: string | null;
          team_a_players?: string[] | null;
          team_b_players?: string[] | null;
          score_a?: number | null;
          score_b?: number | null;
          winner_team?: "A" | "B" | "DRAW" | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_group_organization: { Args: { p_organization_id: string; p_name: string; p_slug: string }; Returns: Json };
      set_group_archived: { Args: { p_organization_id: string; p_archived: boolean }; Returns: Json };
      purge_group: { Args: { p_organization_id: string }; Returns: Json };
      delete_group_player: { Args: { p_player_id: string; p_organization_id: string }; Returns: Json };
      retire_group_player_photo: { Args: { p_player_id: string; p_organization_id: string; p_expected_path: string; p_activity_before: string }; Returns: boolean };
      enqueue_media_cleanup: { Args: { p_bucket: string; p_path: string; p_pending_upload?: boolean }; Returns: undefined };
      claim_media_cleanup: { Args: { p_limit?: number }; Returns: Json };
      complete_media_cleanup: { Args: { p_job_id: string; p_lease_token: string; p_error?: string | null }; Returns: undefined };
      consume_shared_rate_limit: { Args: { p_key_hash: string; p_limit: number; p_window_ms: number }; Returns: Json };
      replace_group_match_options: {
        Args: { p_match_id: string; p_organization_id: string; p_expected_version: number; p_options: Json };
        Returns: Json;
      };
      save_group_match_formation: {
        Args: { p_match_id: string; p_organization_id: string; p_expected_version: number; p_formation: Json | null };
        Returns: Json;
      };
      save_group_match_result: {
        Args: { p_match_id: string; p_organization_id: string; p_expected_version: number; p_input: Json; p_finish?: boolean };
        Returns: Json;
      };
      confirm_group_match_option: {
        Args: { p_match_id: string; p_organization_id: string; p_option_id: string; p_team_a_label?: string | null; p_team_b_label?: string | null };
        Returns: Json;
      };
      ensure_group_current_season: {
        Args: { p_organization_id: string };
        Returns: string;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      match_modality: "5v5" | "6v6" | "7v7" | "9v9" | "10v10" | "11v11";
      match_status: "draft" | "confirmed" | "finished" | "cancelled";
      team_side: "A" | "B";
      winner_team: "A" | "B" | "DRAW";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type DbTables = Database["public"]["Tables"];
