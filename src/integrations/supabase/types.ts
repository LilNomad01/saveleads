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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      automation_queue: {
        Row: {
          created_at: string
          erro: string | null
          fonte: string | null
          id: string
          lead_data: Json
          lead_id: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          erro?: string | null
          fonte?: string | null
          id?: string
          lead_data?: Json
          lead_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          erro?: string | null
          fonte?: string | null
          id?: string
          lead_data?: Json
          lead_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      campanhas: {
        Row: {
          created_at: string
          delay_max: number | null
          delay_min: number | null
          id: string
          mensagens: Json
          nome: string
          status: string | null
          total_entregues: number | null
          total_enviados: number | null
          total_falhas: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delay_max?: number | null
          delay_min?: number | null
          id?: string
          mensagens?: Json
          nome: string
          status?: string | null
          total_entregues?: number | null
          total_enviados?: number | null
          total_falhas?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delay_max?: number | null
          delay_min?: number | null
          id?: string
          mensagens?: Json
          nome?: string
          status?: string | null
          total_entregues?: number | null
          total_enviados?: number | null
          total_falhas?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      extraction_logs: {
        Row: {
          created_at: string
          dados: Json | null
          id: string
          mensagem: string
          session_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          id?: string
          mensagem: string
          session_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          id?: string
          mensagem?: string
          session_id?: string
          tipo?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          avaliacao: number | null
          categoria: string | null
          cidade: string | null
          created_at: string
          data_disparo: string | null
          data_extracao: string
          data_mensagem_enviada: string | null
          email: string | null
          endereco: string | null
          fonte: string | null
          id: string
          mensagem_enviada: boolean | null
          metadata_json: Json | null
          nome_empresa: string
          site: string | null
          status: string | null
          telefone_original: string | null
          total_avaliacoes: number | null
          updated_at: string
          user_id: string | null
          whatsapp_numero: string | null
        }
        Insert: {
          avaliacao?: number | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string
          data_disparo?: string | null
          data_extracao?: string
          data_mensagem_enviada?: string | null
          email?: string | null
          endereco?: string | null
          fonte?: string | null
          id?: string
          mensagem_enviada?: boolean | null
          metadata_json?: Json | null
          nome_empresa: string
          site?: string | null
          status?: string | null
          telefone_original?: string | null
          total_avaliacoes?: number | null
          updated_at?: string
          user_id?: string | null
          whatsapp_numero?: string | null
        }
        Update: {
          avaliacao?: number | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string
          data_disparo?: string | null
          data_extracao?: string
          data_mensagem_enviada?: string | null
          email?: string | null
          endereco?: string | null
          fonte?: string | null
          id?: string
          mensagem_enviada?: boolean | null
          metadata_json?: Json | null
          nome_empresa?: string
          site?: string | null
          status?: string | null
          telefone_original?: string | null
          total_avaliacoes?: number | null
          updated_at?: string
          user_id?: string | null
          whatsapp_numero?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apify_api_token: string | null
          created_at: string
          full_name: string | null
          id: string
          n8n_webhook_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apify_api_token?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          n8n_webhook_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apify_api_token?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          n8n_webhook_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews_negativos: {
        Row: {
          autor: string | null
          cidade: string | null
          created_at: string
          data_extracao: string
          data_review: string | null
          empresa: string
          endereco: string | null
          fonte: string | null
          id: string
          rating: number | null
          rating_medio: number | null
          review: string | null
          telefone: string | null
          total_reviews: number | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          autor?: string | null
          cidade?: string | null
          created_at?: string
          data_extracao?: string
          data_review?: string | null
          empresa: string
          endereco?: string | null
          fonte?: string | null
          id?: string
          rating?: number | null
          rating_medio?: number | null
          review?: string | null
          telefone?: string | null
          total_reviews?: number | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          autor?: string | null
          cidade?: string | null
          created_at?: string
          data_extracao?: string
          data_review?: string | null
          empresa?: string
          endereco?: string | null
          fonte?: string | null
          id?: string
          rating?: number | null
          rating_medio?: number | null
          review?: string | null
          telefone?: string | null
          total_reviews?: number | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      telegram_leads: {
        Row: {
          categoria: string | null
          created_at: string
          data_extracao: string
          descricao: string | null
          fonte: string | null
          id: string
          link: string | null
          membros: number | null
          nome: string
          tipo: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data_extracao?: string
          descricao?: string | null
          fonte?: string | null
          id?: string
          link?: string | null
          membros?: number | null
          nome: string
          tipo?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data_extracao?: string
          descricao?: string | null
          fonte?: string | null
          id?: string
          link?: string | null
          membros?: number | null
          nome?: string
          tipo?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
