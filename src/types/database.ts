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
      organizations: {
        Row: {
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
          id: string;
          location: string | null;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
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
          id?: string;
          location?: string | null;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
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
          id?: string;
          location?: string | null;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
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
      tournaments: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          is_public: boolean;
          name: string;
          parent_tournament_id: string | null;
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
          parent_tournament_id?: string | null;
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
          parent_tournament_id?: string | null;
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
      tournament_billing_payments: {
        Row: {
          admin_id: string;
          amount: number;
          approved_at: string | null;
          checkout_sandbox_url: string | null;
          checkout_url: string | null;
          created_at: string;
          created_tournament_id: string | null;
          currency_id: string;
          id: string;
          mp_external_reference: string;
          mp_payment_id: string | null;
          mp_preference_id: string | null;
          raw_payment: Json | null;
          requested_tournament_name: string;
          requested_tournament_slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          admin_id: string;
          amount: number;
          approved_at?: string | null;
          checkout_sandbox_url?: string | null;
          checkout_url?: string | null;
          created_at?: string;
          created_tournament_id?: string | null;
          currency_id: string;
          id?: string;
          mp_external_reference: string;
          mp_payment_id?: string | null;
          mp_preference_id?: string | null;
          raw_payment?: Json | null;
          requested_tournament_name: string;
          requested_tournament_slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          admin_id?: string;
          amount?: number;
          approved_at?: string | null;
          checkout_sandbox_url?: string | null;
          checkout_url?: string | null;
          created_at?: string;
          created_tournament_id?: string | null;
          currency_id?: string;
          id?: string;
          mp_external_reference?: string;
          mp_payment_id?: string | null;
          mp_preference_id?: string | null;
          raw_payment?: Json | null;
          requested_tournament_name?: string;
          requested_tournament_slug?: string;
          status?: string;
          updated_at?: string;
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
          position: "arquero" | "defensor" | "volante" | "delantero" | null;
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
          position?: "arquero" | "defensor" | "volante" | "delantero" | null;
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
          position?: "arquero" | "defensor" | "volante" | "delantero" | null;
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
      clubs: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          home_venue: string | null;
          id: string;
          is_public: boolean;
          logo_path: string | null;
          name: string;
          slug: string;
          status: "draft" | "active" | "archived";
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          home_venue?: string | null;
          id?: string;
          is_public?: boolean;
          logo_path?: string | null;
          name: string;
          slug: string;
          status?: "draft" | "active" | "archived";
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          home_venue?: string | null;
          id?: string;
          is_public?: boolean;
          logo_path?: string | null;
          name?: string;
          slug?: string;
          status?: "draft" | "active" | "archived";
          updated_at?: string;
        };
        Relationships: [];
      };
      club_admins: {
        Row: {
          admin_id: string;
          club_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
        };
        Insert: {
          admin_id: string;
          club_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
        };
        Update: {
          admin_id?: string;
          club_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      club_admin_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          club_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invite_token: string;
          invited_by: string;
          status: "pending" | "accepted" | "revoked";
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          club_id: string;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invite_token?: string;
          invited_by: string;
          status?: "pending" | "accepted" | "revoked";
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          club_id?: string;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invite_token?: string;
          invited_by?: string;
          status?: "pending" | "accepted" | "revoked";
        };
        Relationships: [];
      };
      club_competitions: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_players: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          full_name: string;
          id: string;
          nickname: string | null;
          notes: string | null;
          photo_path: string | null;
          position: string | null;
          shirt_number: number | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          full_name: string;
          id?: string;
          nickname?: string | null;
          notes?: string | null;
          photo_path?: string | null;
          position?: string | null;
          shirt_number?: number | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          nickname?: string | null;
          notes?: string | null;
          photo_path?: string | null;
          position?: string | null;
          shirt_number?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_teams: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          logo_path: string | null;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
          name: string;
          notes: string | null;
          short_name: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
          name: string;
          notes?: string | null;
          short_name?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
          name?: string;
          notes?: string | null;
          short_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_team_players: {
        Row: {
          club_player_id: string;
          club_team_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          club_player_id: string;
          club_team_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          club_player_id?: string;
          club_team_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      club_matches: {
        Row: {
          club_competition_id: string | null;
          club_id: string;
          club_team_id: string;
          created_at: string;
          created_by: string;
          goals_against: number;
          goals_for: number;
          id: string;
          field_cost_cents: number;
          field_cost_currency: string;
          modality: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
          notes: string | null;
          opponent_name: string;
          played_at: string;
          status: "draft" | "played" | "cancelled";
          updated_at: string;
          venue: string | null;
        };
        Insert: {
          club_competition_id?: string | null;
          club_id: string;
          club_team_id: string;
          created_at?: string;
          created_by: string;
          goals_against?: number;
          goals_for?: number;
          id?: string;
          field_cost_cents?: number;
          field_cost_currency?: string;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
          notes?: string | null;
          opponent_name: string;
          played_at: string;
          status?: "draft" | "played" | "cancelled";
          updated_at?: string;
          venue?: string | null;
        };
        Update: {
          club_competition_id?: string | null;
          club_id?: string;
          club_team_id?: string;
          created_at?: string;
          created_by?: string;
          goals_against?: number;
          goals_for?: number;
          id?: string;
          field_cost_cents?: number;
          field_cost_currency?: string;
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11";
          notes?: string | null;
          opponent_name?: string;
          played_at?: string;
          status?: "draft" | "played" | "cancelled";
          updated_at?: string;
          venue?: string | null;
        };
        Relationships: [];
      };
      club_match_lineups: {
        Row: {
          club_player_id: string | null;
          created_at: string;
          display_name: string;
          guest_name: string | null;
          id: string;
          match_id: string;
          role: "starter" | "substitute" | "present";
        };
        Insert: {
          club_player_id?: string | null;
          created_at?: string;
          display_name: string;
          guest_name?: string | null;
          id?: string;
          match_id: string;
          role?: "starter" | "substitute" | "present";
        };
        Update: {
          club_player_id?: string | null;
          created_at?: string;
          display_name?: string;
          guest_name?: string | null;
          id?: string;
          match_id?: string;
          role?: "starter" | "substitute" | "present";
        };
        Relationships: [];
      };
      club_match_payments: {
        Row: {
          created_at: string;
          expected_cents: number;
          id: string;
          lineup_id: string;
          match_id: string;
          notes: string | null;
          paid_at: string | null;
          paid_cents: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          expected_cents?: number;
          id?: string;
          lineup_id: string;
          match_id: string;
          notes?: string | null;
          paid_at?: string | null;
          paid_cents?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          expected_cents?: number;
          id?: string;
          lineup_id?: string;
          match_id?: string;
          notes?: string | null;
          paid_at?: string | null;
          paid_cents?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      club_match_player_stats: {
        Row: {
          assists: number;
          created_at: string;
          goals: number;
          id: string;
          is_mvp: boolean;
          lineup_id: string;
          match_id: string;
          updated_at: string;
        };
        Insert: {
          assists?: number;
          created_at?: string;
          goals?: number;
          id?: string;
          is_mvp?: boolean;
          lineup_id: string;
          match_id: string;
          updated_at?: string;
        };
        Update: {
          assists?: number;
          created_at?: string;
          goals?: number;
          id?: string;
          is_mvp?: boolean;
          lineup_id?: string;
          match_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_public_snapshots: {
        Row: {
          activity: Json;
          available_modalities: Json;
          by_modality: Json;
          club_id: string;
          competition_stats: Json;
          player_stats: Json;
          recent_matches: Json;
          refreshed_at: string;
          records: Json;
          summary: Json;
          teams: Json;
          top_assisters: Json;
          top_figures: Json;
          top_scorers: Json;
          updated_at: string;
        };
        Insert: {
          activity?: Json;
          available_modalities?: Json;
          by_modality?: Json;
          club_id: string;
          competition_stats?: Json;
          player_stats?: Json;
          recent_matches?: Json;
          refreshed_at?: string;
          records?: Json;
          summary?: Json;
          teams?: Json;
          top_assisters?: Json;
          top_figures?: Json;
          top_scorers?: Json;
          updated_at?: string;
        };
        Update: {
          activity?: Json;
          available_modalities?: Json;
          by_modality?: Json;
          club_id?: string;
          competition_stats?: Json;
          player_stats?: Json;
          recent_matches?: Json;
          refreshed_at?: string;
          records?: Json;
          summary?: Json;
          teams?: Json;
          top_assisters?: Json;
          top_figures?: Json;
          top_scorers?: Json;
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
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11" | null;
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
          modality?: "5v5" | "6v6" | "7v7" | "9v9" | "11v11" | null;
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
      club_status: "draft" | "active" | "archived";
      club_match_status: "draft" | "played" | "cancelled";
      club_lineup_role: "starter" | "substitute" | "present";
      winner_team: "A" | "B" | "DRAW";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type DbTables = Database["public"]["Tables"];
