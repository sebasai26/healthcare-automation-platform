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
      analisis_ia: {
        Row: {
          acciones: Json | null
          anio: number
          areas_mejora: Json | null
          cosas_positivas: Json | null
          created_at: string
          diagnostico: string | null
          id: string
          objetivo_mes: string | null
          objetivo_mes_contexto: string | null
          oportunidades: Json | null
          problemas: Json | null
          semana: number
        }
        Insert: {
          acciones?: Json | null
          anio: number
          areas_mejora?: Json | null
          cosas_positivas?: Json | null
          created_at?: string
          diagnostico?: string | null
          id?: string
          objetivo_mes?: string | null
          objetivo_mes_contexto?: string | null
          oportunidades?: Json | null
          problemas?: Json | null
          semana: number
        }
        Update: {
          acciones?: Json | null
          anio?: number
          areas_mejora?: Json | null
          cosas_positivas?: Json | null
          created_at?: string
          diagnostico?: string | null
          id?: string
          objetivo_mes?: string | null
          objetivo_mes_contexto?: string | null
          oportunidades?: Json | null
          problemas?: Json | null
          semana?: number
        }
        Relationships: []
      }
      analisis_servicios: {
        Row: {
          anio: number
          clinica: string
          created_at: string
          duracion_media: number | null
          especialidad: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          imp_cita: number | null
          imp_servicio: number | null
          importe_total: number | null
          mes: number | null
          mutua: string | null
          num_citas: number | null
          periodo_tipo: string | null
          semana: number | null
          servicio: string
          total_base: number | null
          total_desc: number | null
          total_iva: number | null
          total_ret: number | null
        }
        Insert: {
          anio?: number
          clinica: string
          created_at?: string
          duracion_media?: number | null
          especialidad?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          imp_cita?: number | null
          imp_servicio?: number | null
          importe_total?: number | null
          mes?: number | null
          mutua?: string | null
          num_citas?: number | null
          periodo_tipo?: string | null
          semana?: number | null
          servicio: string
          total_base?: number | null
          total_desc?: number | null
          total_iva?: number | null
          total_ret?: number | null
        }
        Update: {
          anio?: number
          clinica?: string
          created_at?: string
          duracion_media?: number | null
          especialidad?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          imp_cita?: number | null
          imp_servicio?: number | null
          importe_total?: number | null
          mes?: number | null
          mutua?: string | null
          num_citas?: number | null
          periodo_tipo?: string | null
          semana?: number | null
          servicio?: string
          total_base?: number | null
          total_desc?: number | null
          total_iva?: number | null
          total_ret?: number | null
        }
        Relationships: []
      }
      balance_mensual: {
        Row: {
          anio: number
          bono_regalo: number | null
          created_at: string
          domiciliacion: number | null
          efectivo: number | null
          fecha: string | null
          id: string
          mes: string
          talon_transferencia: number | null
          tarjeta: number | null
          total: number | null
        }
        Insert: {
          anio?: number
          bono_regalo?: number | null
          created_at?: string
          domiciliacion?: number | null
          efectivo?: number | null
          fecha?: string | null
          id?: string
          mes: string
          talon_transferencia?: number | null
          tarjeta?: number | null
          total?: number | null
        }
        Update: {
          anio?: number
          bono_regalo?: number | null
          created_at?: string
          domiciliacion?: number | null
          efectivo?: number | null
          fecha?: string | null
          id?: string
          mes?: string
          talon_transferencia?: number | null
          tarjeta?: number | null
          total?: number | null
        }
        Relationships: []
      }
      balance_profesional: {
        Row: {
          anio: number
          bono_regalo: number | null
          created_at: string
          domiciliacion: number | null
          efectivo: number | null
          fecha: string | null
          id: string
          liquido: number | null
          mes: string
          porcentaje: number | null
          talon_transferencia: number | null
          tarjeta: number | null
          total: number | null
          usuario: string
        }
        Insert: {
          anio?: number
          bono_regalo?: number | null
          created_at?: string
          domiciliacion?: number | null
          efectivo?: number | null
          fecha?: string | null
          id?: string
          liquido?: number | null
          mes: string
          porcentaje?: number | null
          talon_transferencia?: number | null
          tarjeta?: number | null
          total?: number | null
          usuario: string
        }
        Update: {
          anio?: number
          bono_regalo?: number | null
          created_at?: string
          domiciliacion?: number | null
          efectivo?: number | null
          fecha?: string | null
          id?: string
          liquido?: number | null
          mes?: string
          porcentaje?: number | null
          talon_transferencia?: number | null
          tarjeta?: number | null
          total?: number | null
          usuario?: string
        }
        Relationships: []
      }
      citas_profesional: {
        Row: {
          abril: number | null
          agosto: number | null
          anio: number
          created_at: string
          diciembre: number | null
          enero: number | null
          febrero: number | null
          id: string
          julio: number | null
          junio: number | null
          marzo: number | null
          mayo: number | null
          noviembre: number | null
          octubre: number | null
          septiembre: number | null
          usuario: string
        }
        Insert: {
          abril?: number | null
          agosto?: number | null
          anio?: number
          created_at?: string
          diciembre?: number | null
          enero?: number | null
          febrero?: number | null
          id?: string
          julio?: number | null
          junio?: number | null
          marzo?: number | null
          mayo?: number | null
          noviembre?: number | null
          octubre?: number | null
          septiembre?: number | null
          usuario: string
        }
        Update: {
          abril?: number | null
          agosto?: number | null
          anio?: number
          created_at?: string
          diciembre?: number | null
          enero?: number | null
          febrero?: number | null
          id?: string
          julio?: number | null
          junio?: number | null
          marzo?: number | null
          mayo?: number | null
          noviembre?: number | null
          octubre?: number | null
          septiembre?: number | null
          usuario?: string
        }
        Relationships: []
      }
      clinic_config: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      contabilidad_clinica: {
        Row: {
          abril: number | null
          agosto: number | null
          anio: number
          concepto: string
          created_at: string
          diciembre: number | null
          enero: number | null
          febrero: number | null
          id: string
          julio: number | null
          junio: number | null
          marzo: number | null
          mayo: number | null
          noviembre: number | null
          octubre: number | null
          seccion: string
          septiembre: number | null
          total: number | null
        }
        Insert: {
          abril?: number | null
          agosto?: number | null
          anio?: number
          concepto: string
          created_at?: string
          diciembre?: number | null
          enero?: number | null
          febrero?: number | null
          id?: string
          julio?: number | null
          junio?: number | null
          marzo?: number | null
          mayo?: number | null
          noviembre?: number | null
          octubre?: number | null
          seccion: string
          septiembre?: number | null
          total?: number | null
        }
        Update: {
          abril?: number | null
          agosto?: number | null
          anio?: number
          concepto?: string
          created_at?: string
          diciembre?: number | null
          enero?: number | null
          febrero?: number | null
          id?: string
          julio?: number | null
          junio?: number | null
          marzo?: number | null
          mayo?: number | null
          noviembre?: number | null
          octubre?: number | null
          seccion?: string
          septiembre?: number | null
          total?: number | null
        }
        Relationships: []
      }
      cumple_inactivos: {
        Row: {
          apellidos: string | null
          created_at: string
          dias_inactivo: number
          fecha_nacimiento: string | null
          id: string
          nh: string | null
          nombre: string
          numero_paciente: string | null
          procesado: boolean
          telefono: string
          ultima_cita: string | null
        }
        Insert: {
          apellidos?: string | null
          created_at?: string
          dias_inactivo: number
          fecha_nacimiento?: string | null
          id?: string
          nh?: string | null
          nombre: string
          numero_paciente?: string | null
          procesado?: boolean
          telefono: string
          ultima_cita?: string | null
        }
        Update: {
          apellidos?: string | null
          created_at?: string
          dias_inactivo?: number
          fecha_nacimiento?: string | null
          id?: string
          nh?: string | null
          nombre?: string
          numero_paciente?: string | null
          procesado?: boolean
          telefono?: string
          ultima_cita?: string | null
        }
        Relationships: []
      }
      horas_profesional: {
        Row: {
          abril: number | null
          agosto: number | null
          anio: number
          created_at: string
          diciembre: number | null
          enero: number | null
          febrero: number | null
          id: string
          julio: number | null
          junio: number | null
          marzo: number | null
          mayo: number | null
          noviembre: number | null
          octubre: number | null
          septiembre: number | null
          usuario: string
        }
        Insert: {
          abril?: number | null
          agosto?: number | null
          anio?: number
          created_at?: string
          diciembre?: number | null
          enero?: number | null
          febrero?: number | null
          id?: string
          julio?: number | null
          junio?: number | null
          marzo?: number | null
          mayo?: number | null
          noviembre?: number | null
          octubre?: number | null
          septiembre?: number | null
          usuario: string
        }
        Update: {
          abril?: number | null
          agosto?: number | null
          anio?: number
          created_at?: string
          diciembre?: number | null
          enero?: number | null
          febrero?: number | null
          id?: string
          julio?: number | null
          junio?: number | null
          marzo?: number | null
          mayo?: number | null
          noviembre?: number | null
          octubre?: number | null
          septiembre?: number | null
          usuario?: string
        }
        Relationships: []
      }
      listado_citas: {
        Row: {
          accion_id: string | null
          agenda: string
          anio: number
          asunto: string | null
          confirmada: boolean | null
          created_at: string
          estado: string
          fecha_cita: string
          fecha_creacion: string | null
          id: string
          importe: number | null
          mes: string
          paciente_nombre: string | null
          paciente_telefono: string | null
          procedencia: string | null
          sala_box: string | null
          semana: number | null
          servicio: string | null
          source_key: string
          tipo: string | null
        }
        Insert: {
          accion_id?: string | null
          agenda: string
          anio: number
          asunto?: string | null
          confirmada?: boolean | null
          created_at?: string
          estado: string
          fecha_cita: string
          fecha_creacion?: string | null
          id?: string
          importe?: number | null
          mes: string
          paciente_nombre?: string | null
          paciente_telefono?: string | null
          procedencia?: string | null
          sala_box?: string | null
          semana?: number | null
          servicio?: string | null
          source_key: string
          tipo?: string | null
        }
        Update: {
          accion_id?: string | null
          agenda?: string
          anio?: number
          asunto?: string | null
          confirmada?: boolean | null
          created_at?: string
          estado?: string
          fecha_cita?: string
          fecha_creacion?: string | null
          id?: string
          importe?: number | null
          mes?: string
          paciente_nombre?: string | null
          paciente_telefono?: string | null
          procedencia?: string | null
          sala_box?: string | null
          semana?: number | null
          servicio?: string | null
          source_key?: string
          tipo?: string | null
        }
        Relationships: []
      }
      objetivo_mensual: {
        Row: {
          anio: number
          contexto: string | null
          created_at: string
          id: string
          mes: number
          objetivo: string
          tendencia_negativa_principal: string | null
          updated_at: string
        }
        Insert: {
          anio: number
          contexto?: string | null
          created_at?: string
          id?: string
          mes: number
          objetivo: string
          tendencia_negativa_principal?: string | null
          updated_at?: string
        }
        Update: {
          anio?: number
          contexto?: string | null
          created_at?: string
          id?: string
          mes?: number
          objetivo?: string
          tendencia_negativa_principal?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ocupacion_profesional: {
        Row: {
          abril: number | null
          agosto: number | null
          anio: number
          created_at: string
          diciembre: number | null
          enero: number | null
          febrero: number | null
          id: string
          julio: number | null
          junio: number | null
          marzo: number | null
          mayo: number | null
          noviembre: number | null
          octubre: number | null
          septiembre: number | null
          usuario: string
        }
        Insert: {
          abril?: number | null
          agosto?: number | null
          anio?: number
          created_at?: string
          diciembre?: number | null
          enero?: number | null
          febrero?: number | null
          id?: string
          julio?: number | null
          junio?: number | null
          marzo?: number | null
          mayo?: number | null
          noviembre?: number | null
          octubre?: number | null
          septiembre?: number | null
          usuario: string
        }
        Update: {
          abril?: number | null
          agosto?: number | null
          anio?: number
          created_at?: string
          diciembre?: number | null
          enero?: number | null
          febrero?: number | null
          id?: string
          julio?: number | null
          junio?: number | null
          marzo?: number | null
          mayo?: number | null
          noviembre?: number | null
          octubre?: number | null
          septiembre?: number | null
          usuario?: string
        }
        Relationships: []
      }
      pacientes_demograficos: {
        Row: {
          apellidos: string | null
          created_at: string
          fecha_nacimiento: string | null
          id: string
          nh: string
          nombre: string
          sexo: string
          telefono: string | null
        }
        Insert: {
          apellidos?: string | null
          created_at?: string
          fecha_nacimiento?: string | null
          id?: string
          nh: string
          nombre: string
          sexo?: string
          telefono?: string | null
        }
        Update: {
          apellidos?: string | null
          created_at?: string
          fecha_nacimiento?: string | null
          id?: string
          nh?: string
          nombre?: string
          sexo?: string
          telefono?: string | null
        }
        Relationships: []
      }
      sugerencias_guardadas: {
        Row: {
          created_at: string
          fecha_guardado: string
          hoja_ruta: string
          id: string
          objetivo: string
          titulo: string
          topic: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          fecha_guardado?: string
          hoja_ruta: string
          id?: string
          objetivo: string
          titulo: string
          topic: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          fecha_guardado?: string
          hoja_ruta?: string
          id?: string
          objetivo?: string
          titulo?: string
          topic?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sugerencias_guardadas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
