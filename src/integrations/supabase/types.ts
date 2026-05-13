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
          bakong_account_id: string | null
          bakong_merchant_city: string | null
          bakong_merchant_name: string | null
          bakong_merchant_phone: string | null
          coins_per_usd: number
          id: number
          tx_ttl_min: number
          updated_at: string
        }
        Insert: {
          bakong_account_id?: string | null
          bakong_merchant_city?: string | null
          bakong_merchant_name?: string | null
          bakong_merchant_phone?: string | null
          coins_per_usd?: number
          id?: number
          tx_ttl_min?: number
          updated_at?: string
        }
        Update: {
          bakong_account_id?: string | null
          bakong_merchant_city?: string | null
          bakong_merchant_name?: string | null
          bakong_merchant_phone?: string | null
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
      transactions: {
        Row: {
          amount_usd: number
          bakong_md5: string
          bakong_tx_ref: string | null
          coins: number
          completed_at: string | null
          created_at: string
          expires_at: string
          failure_reason: string | null
          gateway_event_id: string | null
          id: string
          last_poll_http_status: number | null
          last_poll_latency_ms: number | null
          last_polled_at: string | null
          order_id: string
          paid_at: string | null
          payment_method: string
          provider_payload: Json | null
          qr_string: string
          status: Database["public"]["Enums"]["tx_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          bakong_md5: string
          bakong_tx_ref?: string | null
          coins: number
          completed_at?: string | null
          created_at?: string
          expires_at: string
          failure_reason?: string | null
          gateway_event_id?: string | null
          id?: string
          last_poll_http_status?: number | null
          last_poll_latency_ms?: number | null
          last_polled_at?: string | null
          order_id: string
          paid_at?: string | null
          payment_method?: string
          provider_payload?: Json | null
          qr_string: string
          status?: Database["public"]["Enums"]["tx_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          bakong_md5?: string
          bakong_tx_ref?: string | null
          coins?: number
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          failure_reason?: string | null
          gateway_event_id?: string | null
          id?: string
          last_poll_http_status?: number | null
          last_poll_latency_ms?: number | null
          last_polled_at?: string | null
          order_id?: string
          paid_at?: string | null
          payment_method?: string
          provider_payload?: Json | null
          qr_string?: string
          status?: Database["public"]["Enums"]["tx_status"]
          updated_at?: string
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
        Args: { _md5: string }
        Returns: {
          message: string
          new_balance: number
          ok: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_transaction_poll_result: {
        Args: {
          _http_status: number
          _latency_ms: number
          _next_status?: Database["public"]["Enums"]["tx_status"]
          _order_id: string
          _provider_payload: Json
        }
        Returns: {
          amount_usd: number
          bakong_md5: string
          bakong_tx_ref: string | null
          coins: number
          completed_at: string | null
          created_at: string
          expires_at: string
          failure_reason: string | null
          gateway_event_id: string | null
          id: string
          last_poll_http_status: number | null
          last_poll_latency_ms: number | null
          last_polled_at: string | null
          order_id: string
          paid_at: string | null
          payment_method: string
          provider_payload: Json | null
          qr_string: string
          status: Database["public"]["Enums"]["tx_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_khqr_payment_atomic: {
        Args: {
          _bakong_tx_ref?: string
          _gateway_event_id?: string
          _order_id: string
          _provider_payload?: Json
        }
        Returns: {
          credited_coins: number
          message: string
          new_balance: number
          ok: boolean
          order_id: string
          status: Database["public"]["Enums"]["tx_status"]
          transaction_id: string
        }[]
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
      tx_status:
        | "pending"
        | "paid"
        | "expired"
        | "cancelled"
        | "completed"
        | "failed"
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
      tx_status: [
        "pending",
        "paid",
        "expired",
        "cancelled",
        "completed",
        "failed",
      ],
    },
  },
} as const
