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
      api_keys_registry: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string | null
          service_name: string
          updated_at: string
          vault_secret_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          service_name: string
          updated_at?: string
          vault_secret_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          service_name?: string
          updated_at?: string
          vault_secret_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_registry_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_teams: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          team_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          team_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_teams_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_users: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_users_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          name: string
          sector_id: string | null
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sector_id?: string | null
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          sector_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      column_automations: {
        Row: {
          column_id: string
          created_at: string
          id: string
          type: string
          value: string
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          type: string
          value: string
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "column_automations_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "columns"
            referencedColumns: ["id"]
          },
        ]
      }
      column_connections: {
        Row: {
          assignee_config: Json | null
          created_at: string
          id: string
          source_column_id: string
          target_column_id: string
          time_options: Json | null
        }
        Insert: {
          assignee_config?: Json | null
          created_at?: string
          id?: string
          source_column_id: string
          target_column_id: string
          time_options?: Json | null
        }
        Update: {
          assignee_config?: Json | null
          created_at?: string
          id?: string
          source_column_id?: string
          target_column_id?: string
          time_options?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "column_connections_source_column_id_fkey"
            columns: ["source_column_id"]
            isOneToOne: false
            referencedRelation: "columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "column_connections_target_column_id_fkey"
            columns: ["target_column_id"]
            isOneToOne: false
            referencedRelation: "columns"
            referencedColumns: ["id"]
          },
        ]
      }
      columns: {
        Row: {
          collection_id: string
          color: string | null
          id: string
          name: string
          position: number
          wip_limit: number | null
        }
        Insert: {
          collection_id: string
          color?: string | null
          id?: string
          name: string
          position?: number
          wip_limit?: number | null
        }
        Update: {
          collection_id?: string
          color?: string | null
          id?: string
          name?: string
          position?: number
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "columns_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      impediments: {
        Row: {
          description: string
          id: string
          reported_at: string
          request_id: string | null
          resolved_at: string | null
          task_id: string
        }
        Insert: {
          description: string
          id?: string
          reported_at?: string
          request_id?: string | null
          resolved_at?: string | null
          task_id: string
        }
        Update: {
          description?: string
          id?: string
          reported_at?: string
          request_id?: string | null
          resolved_at?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impediments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impediments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          sector_ids: string[] | null
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          sector_ids?: string[] | null
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          sector_ids?: string[] | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notification_preferences: Json | null
          phone: string | null
          sector_id: string | null
          slack_user_id: string | null
          updated_at: string
          user_id: string
          whatsapp_notifications: boolean
          workspace_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notification_preferences?: Json | null
          phone?: string | null
          sector_id?: string | null
          slack_user_id?: string | null
          updated_at?: string
          user_id: string
          whatsapp_notifications?: boolean
          workspace_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notification_preferences?: Json | null
          phone?: string | null
          sector_id?: string | null
          slack_user_id?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_notifications?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          accepted_task_id: string | null
          created_at: string
          from_user_id: string
          id: string
          impediment_id: string | null
          refusal_reason: string | null
          status: Database["public"]["Enums"]["request_status"]
          suggested_due_date: string | null
          task_description: string | null
          task_title: string
          to_user_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_task_id?: string | null
          created_at?: string
          from_user_id: string
          id?: string
          impediment_id?: string | null
          refusal_reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          suggested_due_date?: string | null
          task_description?: string | null
          task_title: string
          to_user_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_task_id?: string | null
          created_at?: string
          from_user_id?: string
          id?: string
          impediment_id?: string | null
          refusal_reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          suggested_due_date?: string | null
          task_description?: string | null
          task_title?: string
          to_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_accepted_task_id_fkey"
            columns: ["accepted_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_impediment_id_fkey"
            columns: ["impediment_id"]
            isOneToOne: false
            referencedRelation: "impediments"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          updated_at: string
          vault_signing_secret_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          vault_signing_secret_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          vault_signing_secret_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          due_date: string | null
          id: string
          is_done: boolean
          position: number
          task_id: string
          title: string
        }
        Insert: {
          due_date?: string | null
          id?: string
          is_done?: boolean
          position?: number
          task_id: string
          title: string
        }
        Update: {
          due_date?: string | null
          id?: string
          is_done?: boolean
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_kanban_history: {
        Row: {
          collection_id: string
          column_id: string
          entered_at: string
          exited_at: string | null
          id: string
          task_id: string
          time_limit_hours: number | null
        }
        Insert: {
          collection_id: string
          column_id: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          task_id: string
          time_limit_hours?: number | null
        }
        Update: {
          collection_id?: string
          column_id?: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          task_id?: string
          time_limit_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_kanban_history_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_kanban_history_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_kanban_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_schedule_overrides: {
        Row: {
          created_at: string
          hours: number
          id: string
          start_hour: number
          task_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          hours?: number
          id?: string
          start_hour?: number
          task_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          start_hour?: number
          task_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_schedule_overrides_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          collection_id: string
          column_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          duration_days: number | null
          duration_hours: number | null
          id: string
          is_archived: boolean
          is_done: boolean
          linked_task_id: string | null
          position_day: number | null
          position_hour: number | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          collection_id: string
          column_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          duration_days?: number | null
          duration_hours?: number | null
          id?: string
          is_archived?: boolean
          is_done?: boolean
          linked_task_id?: string | null
          position_day?: number | null
          position_hour?: number | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          collection_id?: string
          column_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          duration_days?: number | null
          duration_hours?: number | null
          id?: string
          is_archived?: boolean
          is_done?: boolean
          linked_task_id?: string | null
          position_day?: number | null
          position_hour?: number | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sectors: {
        Row: {
          created_at: string
          id: string
          sector_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sector_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instance_secrets: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          vault_key_id: string | null
          vault_url_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          vault_key_id?: string | null
          vault_url_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          vault_key_id?: string | null
          vault_url_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instance_secrets_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          ai_allowed_phone: string | null
          created_at: string
          id: string
          instance_name: string
          is_active: boolean
          is_default: boolean
          name: string
          phone_number: string | null
          qr_code: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_allowed_phone?: string | null
          created_at?: string
          id?: string
          instance_name: string
          is_active?: boolean
          is_default?: boolean
          name: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          ai_allowed_phone?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          label: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          label?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          label?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_holidays_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          daily_work_hours: number
          id: string
          name: string
          planning_mode: Database["public"]["Enums"]["planning_mode"]
          weekend_days: number[]
          work_start_time: string
        }
        Insert: {
          created_at?: string
          daily_work_hours?: number
          id?: string
          name?: string
          planning_mode?: Database["public"]["Enums"]["planning_mode"]
          weekend_days?: number[]
          work_start_time?: string
        }
        Update: {
          created_at?: string
          daily_work_hours?: number
          id?: string
          name?: string
          planning_mode?: Database["public"]["Enums"]["planning_mode"]
          weekend_days?: number[]
          work_start_time?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_member_ids: { Args: never; Returns: string[] }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_sector_id: { Args: never; Returns: string }
      get_user_sector_ids: { Args: never; Returns: string[] }
      get_user_workspace_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_collection_access: {
        Args: { _collection_id: string; _user_id: string }
        Returns: boolean
      }
      vault_delete_workspace_secret: {
        Args: { _service_name: string; _workspace_id: string }
        Returns: boolean
      }
      vault_read_secret: { Args: { _secret_id: string }; Returns: string }
      vault_store_workspace_secret: {
        Args: {
          _label?: string
          _secret_value: string
          _service_name: string
          _workspace_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "usuario"
      notification_type:
        | "request_received"
        | "request_accepted"
        | "request_refused"
        | "task_due_today"
        | "impediment_resolved"
        | "linked_card_created"
      planning_mode: "hours" | "days"
      request_status: "pending" | "accepted" | "refused"
      task_priority: "baixa" | "media" | "alta" | "urgente"
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
      app_role: ["admin", "gestor", "usuario"],
      notification_type: [
        "request_received",
        "request_accepted",
        "request_refused",
        "task_due_today",
        "impediment_resolved",
        "linked_card_created",
      ],
      planning_mode: ["hours", "days"],
      request_status: ["pending", "accepted", "refused"],
      task_priority: ["baixa", "media", "alta", "urgente"],
    },
  },
} as const
