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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          workshop_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          workshop_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          due_at_km: number | null
          due_date: string | null
          id: string
          notes: string | null
          notified_at: string | null
          reminder_type: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          due_at_km?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          reminder_type: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          due_at_km?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          reminder_type?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_files: {
        Row: {
          created_at: string
          file_size_bytes: number | null
          file_type: string | null
          id: string
          ocr_extracted: Json | null
          service_record_id: string | null
          storage_path: string
          uploaded_by: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          ocr_extracted?: Json | null
          service_record_id?: string | null
          storage_path: string
          uploaded_by: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          ocr_extracted?: Json | null
          service_record_id?: string | null
          storage_path?: string
          uploaded_by?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_files_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: false
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_files_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_records: {
        Row: {
          attestation: string
          cost_aed: number | null
          created_at: string
          created_by: string
          id: string
          next_service_at_date: string | null
          next_service_at_km: number | null
          notes: string | null
          odometer: number | null
          parts: Json | null
          service_date: string
          service_type: string
          updated_at: string
          vehicle_id: string
          workshop_id: string | null
          workshop_name_freetext: string | null
        }
        Insert: {
          attestation?: string
          cost_aed?: number | null
          created_at?: string
          created_by: string
          id?: string
          next_service_at_date?: string | null
          next_service_at_km?: number | null
          notes?: string | null
          odometer?: number | null
          parts?: Json | null
          service_date: string
          service_type: string
          updated_at?: string
          vehicle_id: string
          workshop_id?: string | null
          workshop_name_freetext?: string | null
        }
        Update: {
          attestation?: string
          cost_aed?: number | null
          created_at?: string
          created_by?: string
          id?: string
          next_service_at_date?: string | null
          next_service_at_km?: number | null
          notes?: string | null
          odometer?: number | null
          parts?: Json | null
          service_date?: string
          service_type?: string
          updated_at?: string
          vehicle_id?: string
          workshop_id?: string | null
          workshop_name_freetext?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_access: {
        Row: {
          access_level: string
          created_at: string
          expires_at: string | null
          granted_by: string
          granted_to_user_id: string | null
          granted_to_workshop_id: string | null
          id: string
          vehicle_id: string
        }
        Insert: {
          access_level: string
          created_at?: string
          expires_at?: string | null
          granted_by: string
          granted_to_user_id?: string | null
          granted_to_workshop_id?: string | null
          id?: string
          vehicle_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string
          granted_to_user_id?: string | null
          granted_to_workshop_id?: string | null
          id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_access_granted_to_user_id_fkey"
            columns: ["granted_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_access_granted_to_workshop_id_fkey"
            columns: ["granted_to_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_access_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string
          current_odometer: number | null
          current_odometer_at: string | null
          hero_image_url: string | null
          id: string
          insurance_expires_at: string | null
          make: string
          model: string
          nickname: string | null
          owner_id: string
          plate_emirate: string | null
          plate_number: string | null
          registered_at: string | null
          registration_expires_at: string | null
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          current_odometer?: number | null
          current_odometer_at?: string | null
          hero_image_url?: string | null
          id?: string
          insurance_expires_at?: string | null
          make: string
          model: string
          nickname?: string | null
          owner_id: string
          plate_emirate?: string | null
          plate_number?: string | null
          registered_at?: string | null
          registration_expires_at?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          current_odometer?: number | null
          current_odometer_at?: string | null
          hero_image_url?: string | null
          id?: string
          insurance_expires_at?: string | null
          make?: string
          model?: string
          nickname?: string | null
          owner_id?: string
          plate_emirate?: string | null
          plate_number?: string | null
          registered_at?: string | null
          registration_expires_at?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_members: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_members_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          emirate: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          trade_license: string | null
          updated_at: string
          verification_tier: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          emirate?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          trade_license?: string | null
          updated_at?: string
          verification_tier?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          emirate?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          trade_license?: string | null
          updated_at?: string
          verification_tier?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_vehicle_access: {
        Args: { required_level?: string; vehicle_uuid: string }
        Returns: boolean
      }
      is_workshop_member: { Args: { workshop_uuid: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
