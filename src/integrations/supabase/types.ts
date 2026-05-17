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
      app_settings: {
        Row: {
          coins_per_usd: number
          id: number
          tx_ttl_min: number
          updated_at: string
        }
        Insert: {
          coins_per_usd?: number
          id?: number
          tx_ttl_min?: number
          updated_at?: string
        }
        Update: {
          coins_per_usd?: number
          id?: number
          tx_ttl_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_settings_audit: {
        Row: {
          changed_by: string
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      bakong_webhook_events: {
        Row: {
          delivery_id: string | null
          hash: string | null
          id: string
          md5: string | null
          outcome: string
          payload: Json | null
          received_at: string
          status_code: number
          topup_request_id: string | null
        }
        Insert: {
          delivery_id?: string | null
          hash?: string | null
          id?: string
          md5?: string | null
          outcome: string
          payload?: Json | null
          received_at?: string
          status_code: number
          topup_request_id?: string | null
        }
        Update: {
          delivery_id?: string | null
          hash?: string | null
          id?: string
          md5?: string | null
          outcome?: string
          payload?: Json | null
          received_at?: string
          status_code?: number
          topup_request_id?: string | null
        }
        Relationships: []
      }
      balance_changes: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_balance: number
          old_balance: number
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_balance: number
          old_balance: number
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_balance?: number
          old_balance?: number
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      download_logs: {
        Row: {
          created_at: string
          file_path: string | null
          game_id: string
          id: string
          ip: string | null
          url: string
          user_agent: string | null
          user_id: string
          via: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          game_id: string
          id?: string
          ip?: string | null
          url: string
          user_agent?: string | null
          user_id: string
          via: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          game_id?: string
          id?: string
          ip?: string | null
          url?: string
          user_agent?: string | null
          user_id?: string
          via?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          badge: string | null
          category: string
          created_at: string
          description: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          image_url: string | null
          price_coins: number
          title: string
          visible: boolean
        }
        Insert: {
          badge?: string | null
          category: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id: string
          image_url?: string | null
          price_coins?: number
          title: string
          visible?: boolean
        }
        Update: {
          badge?: string | null
          category?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          image_url?: string | null
          price_coins?: number
          title?: string
          visible?: boolean
        }
        Relationships: []
      }
      library: {
        Row: {
          created_at: string
          game_id: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          id: string
          subtitle: string | null
          title: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      telegram_notifications: {
        Row: {
          attempts: number
          chat_id: string
          created_at: string
          error: string | null
          event_type: string
          http_status: number | null
          id: string
          message_preview: string | null
          status: string
        }
        Insert: {
          attempts?: number
          chat_id: string
          created_at?: string
          error?: string | null
          event_type: string
          http_status?: number | null
          id?: string
          message_preview?: string | null
          status: string
        }
        Update: {
          attempts?: number
          chat_id?: string
          created_at?: string
          error?: string | null
          event_type?: string
          http_status?: number | null
          id?: string
          message_preview?: string | null
          status?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          created_at: string
          game: string | null
          id: string
          name: string
          text: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          game?: string | null
          id?: string
          name: string
          text: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          game?: string | null
          id?: string
          name?: string
          text?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      topup_requests: {
        Row: {
          amount_usd: number
          bakong_response: Json | null
          bakong_verified_at: string | null
          coins: number
          created_at: string
          expires_at: string | null
          id: string
          md5: string | null
          note: string | null
          qr_payload: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slip_path: string | null
          status: Database["public"]["Enums"]["topup_status"]
          user_id: string
        }
        Insert: {
          amount_usd: number
          bakong_response?: Json | null
          bakong_verified_at?: string | null
          coins: number
          created_at?: string
          expires_at?: string | null
          id?: string
          md5?: string | null
          note?: string | null
          qr_payload?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slip_path?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          user_id: string
        }
        Update: {
          amount_usd?: number
          bakong_response?: Json | null
          bakong_verified_at?: string | null
          coins?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          md5?: string | null
          note?: string | null
          qr_payload?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slip_path?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_balance:
        | { Args: { _new_balance: number; _user_id: string }; Returns: number }
        | {
            Args: { _new_balance: number; _reason?: string; _user_id: string }
            Returns: number
          }
      credit_topup_atomic: {
        Args: { _bakong_response: Json; _request_id: string }
        Returns: {
          credited: number
          new_balance: number
          ok: boolean
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purchase_game_atomic: {
        Args: { _game_id: string; _user_id: string }
        Returns: {
          message: string
          new_balance: number
          ok: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      topup_status: "pending" | "approved" | "rejected" | "expired"
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
      app_role: ["admin", "user"],
      topup_status: ["pending", "approved", "rejected", "expired"],
    },
  },
} as const
