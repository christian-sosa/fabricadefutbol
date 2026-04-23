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
      players: {
        Row: {
          active: boolean;
          created_at: string;
          current_rating: number;
          full_name: string;
          id: string;
          initial_rank: number;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          current_rating?: number;
          full_name: string;
          id?: string;
          initial_rank: number;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          current_rating?: number;
          full_name?: string;
          id?: string;
          initial_rank?: number;
          notes?: string | null;
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
          id: string;
          location: string | null;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
          scheduled_at: string;
          status: "draft" | "confirmed" | "finished" | "cancelled";
          updated_at: string;
        };
        Insert: {
          confirmed_option_id?: string | null;
          created_at?: string;
          created_by: string;
          finished_at?: string | null;
          id?: string;
          location?: string | null;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
          scheduled_at: string;
          status?: "draft" | "confirmed" | "finished" | "cancelled";
          updated_at?: string;
        };
        Update: {
          confirmed_option_id?: string | null;
          created_at?: string;
          created_by?: string;
          finished_at?: string | null;
          id?: string;
          location?: string | null;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
          scheduled_at?: string;
          status?: "draft" | "confirmed" | "finished" | "cancelled";
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
          notes: string | null;
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
          notes?: string | null;
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
          notes?: string | null;
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
      tournaments: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          is_public: boolean;
          name: string;
          season_label: string;
          slug: string;
          status: "draft" | "active" | "finished" | "archived";
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          name: string;
          season_label: string;
          slug: string;
          status?: "draft" | "active" | "finished" | "archived";
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          name?: string;
          season_label?: string;
          slug?: string;
          status?: "draft" | "active" | "finished" | "archived";
          updated_at?: string;
        };
        Relationships: [];
      };
      tournament_admins: {
        Row: {
          admin_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          role: "owner" | "editor";
          tournament_id: string;
        };
        Insert: {
          admin_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          role?: "owner" | "editor";
          tournament_id: string;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          role?: "owner" | "editor";
          tournament_id?: string;
        };
        Relationships: [];
      };
      tournament_admin_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invite_token: string;
          invited_by: string;
          status: "pending" | "accepted" | "revoked";
          tournament_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invite_token?: string;
          invited_by: string;
          status?: "pending" | "accepted" | "revoked";
          tournament_id: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invite_token?: string;
          invited_by?: string;
          status?: "pending" | "accepted" | "revoked";
          tournament_id?: string;
        };
        Relationships: [];
      };
      tournament_team_captains: {
        Row: {
          captain_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          team_id: string;
          tournament_id: string;
        };
        Insert: {
          captain_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          team_id: string;
          tournament_id: string;
        };
        Update: {
          captain_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          team_id?: string;
          tournament_id?: string;
        };
        Relationships: [];
      };
      tournament_captain_invites: {
        Row: {
          created_at: string;
          created_by: string;
          email: string;
          expires_at: string;
          id: string;
          invite_token: string;
          team_id: string;
          tournament_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          email: string;
          expires_at?: string;
          id?: string;
          invite_token: string;
          team_id: string;
          tournament_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invite_token?: string;
          team_id?: string;
          tournament_id?: string;
        };
        Relationships: [];
      };
      tournament_teams: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          notes: string | null;
          short_name: string | null;
          slug: string;
          tournament_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_order: number;
          id?: string;
          name: string;
          notes?: string | null;
          short_name?: string | null;
          slug: string;
          tournament_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          name?: string;
          notes?: string | null;
          short_name?: string | null;
          slug?: string;
          tournament_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tournament_players: {
        Row: {
          active: boolean;
          created_at: string;
          full_name: string;
          id: string;
          position: string | null;
          shirt_number: number | null;
          team_id: string;
          tournament_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          full_name: string;
          id?: string;
          position?: string | null;
          shirt_number?: number | null;
          team_id: string;
          tournament_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          full_name?: string;
          id?: string;
          position?: string | null;
          shirt_number?: number | null;
          team_id?: string;
          tournament_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tournament_rounds: {
        Row: {
          created_at: string;
          ends_at: string | null;
          id: string;
          name: string;
          round_number: number;
          starts_at: string | null;
          tournament_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          name: string;
          round_number: number;
          starts_at?: string | null;
          tournament_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          name?: string;
          round_number?: number;
          starts_at?: string | null;
          tournament_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tournament_matches: {
        Row: {
          away_team_id: string;
          created_at: string;
          created_by: string;
          home_team_id: string;
          id: string;
          round_id: string | null;
          scheduled_at: string | null;
          status: "draft" | "scheduled" | "played" | "cancelled";
          tournament_id: string;
          updated_at: string;
          venue: string | null;
        };
        Insert: {
          away_team_id: string;
          created_at?: string;
          created_by: string;
          home_team_id: string;
          id?: string;
          round_id?: string | null;
          scheduled_at?: string | null;
          status?: "draft" | "scheduled" | "played" | "cancelled";
          tournament_id: string;
          updated_at?: string;
          venue?: string | null;
        };
        Update: {
          away_team_id?: string;
          created_at?: string;
          created_by?: string;
          home_team_id?: string;
          id?: string;
          round_id?: string | null;
          scheduled_at?: string | null;
          status?: "draft" | "scheduled" | "played" | "cancelled";
          tournament_id?: string;
          updated_at?: string;
          venue?: string | null;
        };
        Relationships: [];
      };
      tournament_match_results: {
        Row: {
          away_score: number;
          created_at: string;
          created_by: string;
          home_score: number;
          id: string;
          match_id: string;
          mvp_player_id: string | null;
          mvp_player_name: string;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          away_score: number;
          created_at?: string;
          created_by: string;
          home_score: number;
          id?: string;
          match_id: string;
          mvp_player_id?: string | null;
          mvp_player_name: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          away_score?: number;
          created_at?: string;
          created_by?: string;
          home_score?: number;
          id?: string;
          match_id?: string;
          mvp_player_id?: string | null;
          mvp_player_name?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      tournament_match_player_stats: {
        Row: {
          created_at: string;
          goals: number;
          id: string;
          is_mvp: boolean;
          match_id: string;
          player_id: string | null;
          player_name: string;
          red_cards: number;
          team_id: string;
          updated_at: string;
          yellow_cards: number;
        };
        Insert: {
          created_at?: string;
          goals?: number;
          id?: string;
          is_mvp?: boolean;
          match_id: string;
          player_id?: string | null;
          player_name: string;
          red_cards?: number;
          team_id: string;
          updated_at?: string;
          yellow_cards?: number;
        };
        Update: {
          created_at?: string;
          goals?: number;
          id?: string;
          is_mvp?: boolean;
          match_id?: string;
          player_id?: string | null;
          player_name?: string;
          red_cards?: number;
          team_id?: string;
          updated_at?: string;
          yellow_cards?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      public_match_cards: {
        Row: {
          id: string | null;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "11v11" | null;
          scheduled_at: string | null;
          status: "draft" | "confirmed" | "finished" | "cancelled" | null;
          team_a_players: string[] | null;
          team_b_players: string[] | null;
          score_a: number | null;
          score_b: number | null;
          winner_team: "A" | "B" | "DRAW" | null;
        };
        Insert: {
          id?: string | null;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11" | null;
          scheduled_at?: string | null;
          status?: "draft" | "confirmed" | "finished" | "cancelled" | null;
          team_a_players?: string[] | null;
          team_b_players?: string[] | null;
          score_a?: number | null;
          score_b?: number | null;
          winner_team?: "A" | "B" | "DRAW" | null;
        };
        Update: {
          id?: string | null;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11" | null;
          scheduled_at?: string | null;
          status?: "draft" | "confirmed" | "finished" | "cancelled" | null;
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
      can_read_tournament: {
        Args: {
          tournament_id: string;
        };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_tournament_admin: {
        Args: {
          tournament_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      match_modality: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
      match_status: "draft" | "confirmed" | "finished" | "cancelled";
      team_side: "A" | "B";
      tournament_admin_role: "owner" | "editor";
      tournament_match_status: "draft" | "scheduled" | "played" | "cancelled";
      tournament_status: "draft" | "active" | "finished" | "archived";
      winner_team: "A" | "B" | "DRAW";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type DbTables = Database["public"]["Tables"];
