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
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      match_modality: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
      match_status: "draft" | "confirmed" | "finished" | "cancelled";
      winner_team: "A" | "B" | "DRAW";
      team_side: "A" | "B";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type DbTables = Database["public"]["Tables"];
