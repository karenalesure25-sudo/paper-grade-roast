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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      fulfillment_orders: {
        Row: {
          access_token: string
          attempts: number
          checkout_attempt: number
          clarification_request: Json | null
          clarifications: Json
          created_at: string
          delivered_at: string | null
          email: string
          expires_at: string
          failure_reason: string | null
          id: string
          intake_id: string
          is_test: boolean
          job_text: string | null
          lease_id: string | null
          locked_until: string | null
          max_attempts: number
          notifications: Json
          paid_at: string | null
          photo: string | null
          result: Json | null
          retry_rounds: number
          snapshot: Json
          source_sha256: string
          source_text: string
          status: string
          stripe_mode: string
          stripe_session_id: string | null
          template: string
          tier: string
          updated_at: string
        }
        Insert: {
          access_token?: string
          attempts?: number
          checkout_attempt?: number
          clarification_request?: Json | null
          clarifications?: Json
          created_at?: string
          delivered_at?: string | null
          email: string
          expires_at?: string
          failure_reason?: string | null
          id?: string
          intake_id: string
          is_test?: boolean
          job_text?: string | null
          lease_id?: string | null
          locked_until?: string | null
          max_attempts?: number
          notifications?: Json
          paid_at?: string | null
          photo?: string | null
          result?: Json | null
          retry_rounds?: number
          snapshot: Json
          source_sha256: string
          source_text: string
          status?: string
          stripe_mode?: string
          stripe_session_id?: string | null
          template: string
          tier: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          attempts?: number
          checkout_attempt?: number
          clarification_request?: Json | null
          clarifications?: Json
          created_at?: string
          delivered_at?: string | null
          email?: string
          expires_at?: string
          failure_reason?: string | null
          id?: string
          intake_id?: string
          is_test?: boolean
          job_text?: string | null
          lease_id?: string | null
          locked_until?: string | null
          max_attempts?: number
          notifications?: Json
          paid_at?: string | null
          photo?: string | null
          result?: Json | null
          retry_rounds?: number
          snapshot?: Json
          source_sha256?: string
          source_text?: string
          status?: string
          stripe_mode?: string
          stripe_session_id?: string | null
          template?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_orders_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: true
            referencedRelation: "intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      intakes: {
        Row: {
          answers: Json
          career_field: string | null
          company_name: string | null
          confirmed: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          job_description: string | null
          job_file_filename: string | null
          job_file_path: string | null
          job_url: string | null
          phone: string
          resume_filename: string | null
          resume_path: string | null
          specific_job_title: string | null
          target_job_title: string | null
          tier: string
        }
        Insert: {
          answers?: Json
          career_field?: string | null
          company_name?: string | null
          confirmed?: boolean
          created_at?: string
          email: string
          full_name: string
          id?: string
          job_description?: string | null
          job_file_filename?: string | null
          job_file_path?: string | null
          job_url?: string | null
          phone: string
          resume_filename?: string | null
          resume_path?: string | null
          specific_job_title?: string | null
          target_job_title?: string | null
          tier: string
        }
        Update: {
          answers?: Json
          career_field?: string | null
          company_name?: string | null
          confirmed?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_description?: string | null
          job_file_filename?: string | null
          job_file_path?: string | null
          job_url?: string | null
          phone?: string
          resume_filename?: string | null
          resume_path?: string | null
          specific_job_title?: string | null
          target_job_title?: string | null
          tier?: string
        }
        Relationships: []
      }
      order_revisions: {
        Row: {
          attempts: number
          base_revision_id: string | null
          base_version: number
          clarification_request: string | null
          clarifications: Json
          completed_at: string | null
          created_at: string
          deadline_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          kind: string
          lease_id: string | null
          locked_until: string | null
          max_attempts: number
          order_id: string
          request_text: string
          requested_at: string
          result: Json | null
          retry_rounds: number
          status: string
          updated_at: string
          version: number | null
        }
        Insert: {
          attempts?: number
          base_revision_id?: string | null
          base_version?: number
          clarification_request?: string | null
          clarifications?: Json
          completed_at?: string | null
          created_at?: string
          deadline_at: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          kind: string
          lease_id?: string | null
          locked_until?: string | null
          max_attempts?: number
          order_id: string
          request_text: string
          requested_at?: string
          result?: Json | null
          retry_rounds?: number
          status?: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          attempts?: number
          base_revision_id?: string | null
          base_version?: number
          clarification_request?: string | null
          clarifications?: Json
          completed_at?: string | null
          created_at?: string
          deadline_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          lease_id?: string | null
          locked_until?: string | null
          max_attempts?: number
          order_id?: string
          request_text?: string
          requested_at?: string
          result?: Json | null
          retry_rounds?: number
          status?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_revisions_base_revision_id_fkey"
            columns: ["base_revision_id"]
            isOneToOne: false
            referencedRelation: "order_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_revisions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "fulfillment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          ats_report: Json | null
          cover_letter: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          job_label: string | null
          letter_token: string
          resume: Json
          resume_token: string
          source_label: string | null
          template: string
          tier: string
        }
        Insert: {
          ats_report?: Json | null
          cover_letter?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          job_label?: string | null
          letter_token?: string
          resume: Json
          resume_token?: string
          source_label?: string | null
          template: string
          tier: string
        }
        Update: {
          ats_report?: Json | null
          cover_letter?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          job_label?: string | null
          letter_token?: string
          resume?: Json
          resume_token?: string
          source_label?: string | null
          template?: string
          tier?: string
        }
        Relationships: []
      }
      payment_redemptions: {
        Row: {
          amount_cents: number
          created_at: string
          email: string
          session_id: string
          status: string
          stripe_mode: string
          tier: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          email: string
          session_id: string
          status?: string
          stripe_mode?: string
          tier: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          email?: string
          session_id?: string
          status?: string
          stripe_mode?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      recovery_requests: {
        Row: {
          created_at: string
          email_hash: string
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          email_hash: string
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          email_hash?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          attempts: number
          id: string
          processed_at: string | null
          received_at: string
          stripe_mode: string
          type: string
        }
        Insert: {
          attempts?: number
          id: string
          processed_at?: string | null
          received_at?: string
          stripe_mode?: string
          type: string
        }
        Update: {
          attempts?: number
          id?: string
          processed_at?: string | null
          received_at?: string
          stripe_mode?: string
          type?: string
        }
        Relationships: []
      }
      worker_secrets: {
        Row: {
          name: string
          value: string
        }
        Insert: {
          name: string
          value?: string
        }
        Update: {
          name?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admit_recovery_request: {
        Args: {
          _email_hash: string
          _ip_hash: string
          _per_email: number
          _per_ip: number
        }
        Returns: boolean
      }
      claim_fulfillment: {
        Args: { _lease_seconds?: number; _order_id: string }
        Returns: {
          access_token: string
          attempts: number
          checkout_attempt: number
          clarification_request: Json | null
          clarifications: Json
          created_at: string
          delivered_at: string | null
          email: string
          expires_at: string
          failure_reason: string | null
          id: string
          intake_id: string
          is_test: boolean
          job_text: string | null
          lease_id: string | null
          locked_until: string | null
          max_attempts: number
          notifications: Json
          paid_at: string | null
          photo: string | null
          result: Json | null
          retry_rounds: number
          snapshot: Json
          source_sha256: string
          source_text: string
          status: string
          stripe_mode: string
          stripe_session_id: string | null
          template: string
          tier: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "fulfillment_orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_notification: {
        Args: { _kind: string; _lease_seconds?: number; _order_id: string }
        Returns: boolean
      }
      claim_notification_fenced: {
        Args: { _kind: string; _lease_seconds?: number; _order_id: string }
        Returns: string
      }
      claim_revision: {
        Args: { _id: string; _lease_seconds?: number }
        Returns: {
          attempts: number
          base_revision_id: string | null
          base_version: number
          clarification_request: string | null
          clarifications: Json
          completed_at: string | null
          created_at: string
          deadline_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          kind: string
          lease_id: string | null
          locked_until: string | null
          max_attempts: number
          order_id: string
          request_text: string
          requested_at: string
          result: Json | null
          retry_rounds: number
          status: string
          updated_at: string
          version: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "order_revisions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      due_fulfillments: { Args: { _limit?: number }; Returns: string[] }
      due_notifications: {
        Args: { _limit?: number }
        Returns: {
          kind: string
          order_id: string
        }[]
      }
      due_revision_notifications: {
        Args: { _limit?: number }
        Returns: {
          kind: string
          order_id: string
        }[]
      }
      due_revisions: { Args: { _limit?: number }; Returns: string[] }
      finish_notification: {
        Args: { _kind: string; _order_id: string; _patch: Json }
        Returns: undefined
      }
      finish_notification_fenced: {
        Args: { _kind: string; _order_id: string; _patch: Json; _token: string }
        Returns: boolean
      }
      latest_revision_base: {
        Args: { _order_id: string }
        Returns: Record<string, unknown>
      }
      minor_revision_window_end: {
        Args: { _delivered: string }
        Returns: string
      }
      purge_expired_fulfillments: { Args: never; Returns: number }
      renew_fulfillment_lease: {
        Args: { _lease_id: string; _lease_seconds?: number; _order_id: string }
        Returns: boolean
      }
      request_order_revision: {
        Args: {
          _deadline: string
          _idem: string
          _kind: string
          _order_id: string
          _text: string
        }
        Returns: Json
      }
      retry_order_revision: {
        Args: { _id: string; _max_rounds?: number }
        Returns: Json
      }
      settle_stale_fulfillments: { Args: never; Returns: number }
      settle_stale_revision: {
        Args: { _id: string; _lease: string; _reason: string }
        Returns: boolean
      }
      verify_worker_token: {
        Args: { _name: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
