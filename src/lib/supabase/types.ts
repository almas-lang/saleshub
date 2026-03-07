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
      activities: {
        Row: {
          body: string | null
          contact_id: string
          created_at: string
          "email success":
            | Database["public"]["Enums"]["email_send_status"]
            | null
          id: string
          metadata: Json | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string | null
        }
        Insert: {
          body?: string | null
          contact_id: string
          created_at?: string
          "email success"?:
            | Database["public"]["Enums"]["email_send_status"]
            | null
          id?: string
          metadata?: Json | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
        }
        Update: {
          body?: string | null
          contact_id?: string
          created_at?: string
          "email success"?:
            | Database["public"]["Enums"]["email_send_status"]
            | null
          id?: string
          metadata?: Json | null
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_pages: {
        Row: {
          assigned_to: string[] | null
          availability_rules: Json | null
          confirmation_email: boolean | null
          confirmation_wa: boolean | null
          created_at: string
          description: string | null
          duration_minutes: number
          form_fields: Json | null
          google_calendar_id: string | null
          id: string
          is_active: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string[] | null
          availability_rules?: Json | null
          confirmation_email?: boolean | null
          confirmation_wa?: boolean | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          form_fields?: Json | null
          google_calendar_id?: string | null
          id?: string
          is_active?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string[] | null
          availability_rules?: Json | null
          confirmation_email?: boolean | null
          confirmation_wa?: boolean | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          form_fields?: Json | null
          google_calendar_id?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          assigned_to: string | null
          booking_page_id: string | null
          contact_id: string
          created_at: string
          ends_at: string
          google_event_id: string | null
          id: string
          meet_link: string | null
          notes: string | null
          outcome: Database["public"]["Enums"]["booking_outcome"] | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          booking_page_id?: string | null
          contact_id: string
          created_at?: string
          ends_at: string
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["booking_outcome"] | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          booking_page_id?: string | null
          contact_id?: string
          created_at?: string
          ends_at?: string
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["booking_outcome"] | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_booking_page_id_fkey"
            columns: ["booking_page_id"]
            isOneToOne: false
            referencedRelation: "booking_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          gst_number: string | null
          id: string
          industry: string | null
          name: string
          pincode: string | null
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          name: string
          pincode?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          name?: string
          pincode?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contact_form_responses: {
        Row: {
          blocker: string | null
          booking_id: string | null
          contact_id: string
          created_at: string
          current_role: string | null
          desired_salary: string | null
          financial_readiness:
            | Database["public"]["Enums"]["financial_readiness"]
            | null
          form_email: string | null
          id: string
          key_challenge: string | null
          urgency: Database["public"]["Enums"]["urgency_level"] | null
          work_experience: Database["public"]["Enums"]["work_experience"] | null
        }
        Insert: {
          blocker?: string | null
          booking_id?: string | null
          contact_id: string
          created_at?: string
          current_role?: string | null
          desired_salary?: string | null
          financial_readiness?:
            | Database["public"]["Enums"]["financial_readiness"]
            | null
          form_email?: string | null
          id?: string
          key_challenge?: string | null
          urgency?: Database["public"]["Enums"]["urgency_level"] | null
          work_experience?:
            | Database["public"]["Enums"]["work_experience"]
            | null
        }
        Update: {
          blocker?: string | null
          booking_id?: string | null
          contact_id?: string
          created_at?: string
          current_role?: string | null
          desired_salary?: string | null
          financial_readiness?:
            | Database["public"]["Enums"]["financial_readiness"]
            | null
          form_email?: string | null
          id?: string
          key_challenge?: string | null
          urgency?: Database["public"]["Enums"]["urgency_level"] | null
          work_experience?:
            | Database["public"]["Enums"]["work_experience"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_form_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_form_responses_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          assigned_to: string | null
          company_id: string | null
          company_name: string | null
          converted_at: string | null
          created_at: string
          current_stage_id: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          funnel_id: string | null
          id: string
          last_name: string | null
          linkedin_url: string | null
          metadata: Json | null
          phone: string | null
          source: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          assigned_to?: string | null
          company_id?: string | null
          company_name?: string | null
          converted_at?: string | null
          created_at?: string
          current_stage_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name: string
          funnel_id?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          assigned_to?: string | null
          company_id?: string | null
          company_name?: string | null
          converted_at?: string | null
          created_at?: string
          current_stage_id?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          funnel_id?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          metadata?: Json | null
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_programs: {
        Row: {
          amount: number | null
          contact_id: string
          created_at: string
          end_date: string | null
          id: string
          mentor_id: string | null
          notes: string | null
          program_name: string
          sessions_completed: number | null
          sessions_total: number | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          contact_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          mentor_id?: string | null
          notes?: string | null
          program_name: string
          sessions_completed?: number | null
          sessions_total?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          contact_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          mentor_id?: string | null
          notes?: string | null
          program_name?: string
          sessions_completed?: number | null
          sessions_total?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_programs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_programs_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      drip_enrollments: {
        Row: {
          campaign_id: string
          campaign_type: string
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          current_step_order: number | null
          enrolled_at: string | null
          id: string
          next_send_at: string | null
          status: string
          stopped_reason: string | null
        }
        Insert: {
          campaign_id: string
          campaign_type?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          current_step_order?: number | null
          enrolled_at?: string | null
          id?: string
          next_send_at?: string | null
          status?: string
          stopped_reason?: string | null
        }
        Update: {
          campaign_id?: string
          campaign_type?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          current_step_order?: number | null
          enrolled_at?: string | null
          id?: string
          next_send_at?: string | null
          status?: string
          stopped_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drip_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience_filter: Json | null
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["campaign_status"]
          stop_condition: Json | null
          trigger_event: string | null
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          audience_filter?: Json | null
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["campaign_status"]
          stop_condition?: Json | null
          trigger_event?: string | null
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          audience_filter?: Json | null
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          stop_condition?: Json | null
          trigger_event?: string | null
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Relationships: []
      }
      email_sends: {
        Row: {
          campaign_id: string | null
          clicked_at: string | null
          contact_id: string
          created_at: string
          id: string
          opened_at: string | null
          resend_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_send_status"]
          step_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          clicked_at?: string | null
          contact_id: string
          created_at?: string
          id?: string
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_send_status"]
          step_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          clicked_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_send_status"]
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "email_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      email_steps: {
        Row: {
          body_html: string
          campaign_id: string
          condition: Json | null
          created_at: string
          delay_hours: number
          id: string
          order: number
          subject: string
          template_id: string | null
        }
        Insert: {
          body_html: string
          campaign_id: string
          condition?: Json | null
          created_at?: string
          delay_hours?: number
          id?: string
          order: number
          subject: string
          template_id?: string | null
        }
        Update: {
          body_html?: string
          campaign_id?: string
          condition?: Json | null
          created_at?: string
          delay_hours?: number
          id?: string
          order?: number
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html: string
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          contact_id: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          auto_action: Json | null
          color: string
          created_at: string
          funnel_id: string
          id: string
          is_terminal: boolean
          name: string
          order: number
        }
        Insert: {
          auto_action?: Json | null
          color?: string
          created_at?: string
          funnel_id: string
          id?: string
          is_terminal?: boolean
          name: string
          order: number
        }
        Update: {
          auto_action?: Json | null
          color?: string
          created_at?: string
          funnel_id?: string
          id?: string
          is_terminal?: boolean
          name?: string
          order?: number
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          sales_type: Database["public"]["Enums"]["sales_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          sales_type?: Database["public"]["Enums"]["sales_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sales_type?: Database["public"]["Enums"]["sales_type"]
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          contact_id: string
          created_at: string
          due_date: string | null
          gst_amount: number | null
          gst_number: string | null
          gst_rate: number | null
          id: string
          invoice_number: string
          is_recurring: boolean | null
          items: Json
          notes: string | null
          paid_at: string | null
          payment_gateway: Database["public"]["Enums"]["payment_gateway"] | null
          payment_id: string | null
          payment_link: string | null
          pdf_url: string | null
          recurrence_day: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          due_date?: string | null
          gst_amount?: number | null
          gst_number?: string | null
          gst_rate?: number | null
          id?: string
          invoice_number: string
          is_recurring?: boolean | null
          items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_gateway?:
            | Database["public"]["Enums"]["payment_gateway"]
            | null
          payment_id?: string | null
          payment_link?: string | null
          pdf_url?: string | null
          recurrence_day?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          due_date?: string | null
          gst_amount?: number | null
          gst_number?: string | null
          gst_rate?: number | null
          id?: string
          invoice_number?: string
          is_recurring?: boolean | null
          items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_gateway?:
            | Database["public"]["Enums"]["payment_gateway"]
            | null
          payment_id?: string | null
          payment_link?: string | null
          pdf_url?: string | null
          recurrence_day?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          google_access_token: string | null
          google_calendar_connected: boolean | null
          google_calendar_id: string | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["team_role"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          google_access_token?: string | null
          google_calendar_connected?: boolean | null
          google_calendar_id?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          google_access_token?: string | null
          google_calendar_connected?: boolean | null
          google_calendar_id?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          contact_id: string | null
          created_at: string
          date: string
          description: string | null
          gst_applicable: boolean | null
          id: string
          invoice_id: string | null
          receipt_url: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          contact_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          gst_applicable?: boolean | null
          id?: string
          invoice_id?: string | null
          receipt_url?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          contact_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          gst_applicable?: boolean | null
          id?: string
          invoice_id?: string | null
          receipt_url?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_campaigns: {
        Row: {
          audience_filter: Json | null
          created_at: string
          flow_data: Json | null
          id: string
          name: string
          status: Database["public"]["Enums"]["campaign_status"]
          stop_condition: Json | null
          trigger_event: string | null
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          audience_filter?: Json | null
          created_at?: string
          flow_data?: Json | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["campaign_status"]
          stop_condition?: Json | null
          trigger_event?: string | null
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          audience_filter?: Json | null
          created_at?: string
          flow_data?: Json | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          stop_condition?: Json | null
          trigger_event?: string | null
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Relationships: []
      }
      wa_sends: {
        Row: {
          campaign_id: string | null
          contact_id: string
          created_at: string
          delivered_at: string | null
          id: string
          read_at: string | null
          replied: boolean | null
          sent_at: string | null
          status: Database["public"]["Enums"]["wa_send_status"]
          step_id: string | null
          wa_message_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          replied?: boolean | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_send_status"]
          step_id?: string | null
          wa_message_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          replied?: boolean | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_send_status"]
          step_id?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "wa_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_sends_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "wa_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_steps: {
        Row: {
          campaign_id: string
          condition: Json | null
          created_at: string
          delay_hours: number
          id: string
          order: number
          template_id: string | null
          wa_template_name: string
          wa_template_params: Json | null
        }
        Insert: {
          campaign_id: string
          condition?: Json | null
          created_at?: string
          delay_hours?: number
          id?: string
          order: number
          template_id?: string | null
          wa_template_name: string
          wa_template_params?: Json | null
        }
        Update: {
          campaign_id?: string
          condition?: Json | null
          created_at?: string
          delay_hours?: number
          id?: string
          order?: number
          template_id?: string | null
          wa_template_name?: string
          wa_template_params?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "wa_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "wa_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_templates: {
        Row: {
          body_text: string | null
          buttons: Json | null
          category: string | null
          created_at: string
          footer_text: string | null
          header_text: string | null
          id: string
          language: string
          meta_template_id: string | null
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          body_text?: string | null
          buttons?: Json | null
          category?: string | null
          created_at?: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          language?: string
          meta_template_id?: string | null
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          body_text?: string | null
          buttons?: Json | null
          category?: string | null
          created_at?: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          language?: string
          meta_template_id?: string | null
          name?: string
          status?: string | null
          updated_at?: string
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
      account_type: "individual" | "business"
      activity_type:
        | "note"
        | "call"
        | "email_sent"
        | "email_opened"
        | "wa_sent"
        | "wa_delivered"
        | "wa_read"
        | "stage_change"
        | "booking_created"
        | "payment_received"
        | "invoice_sent"
        | "form_submitted"
      booking_outcome:
        | "qualified"
        | "not_qualified"
        | "needs_follow_up"
        | "converted"
      booking_status: "confirmed" | "cancelled" | "completed" | "no_show"
      campaign_status: "draft" | "active" | "paused" | "completed"
      campaign_type: "drip" | "one_time" | "newsletter"
      contact_type: "prospect" | "customer" | "lead"
      email_send_status:
        | "queued"
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "failed"
      financial_readiness: "ready" | "careful_but_open" | "not_ready"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      invoice_type: "estimate" | "invoice"
      payment_gateway: "cashfree" | "stripe" | "manual"
      sales_type:
        | "vsl"
        | "webinar"
        | "workshop"
        | "short_course"
        | "direct_outreach"
        | "custom"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "completed" | "overdue" | "cancelled"
      task_type: "follow_up" | "call" | "email" | "general"
      team_role: "admin" | "sales" | "marketing" | "viewer"
      transaction_type: "income" | "expense"
      urgency_level: "right_now" | "within_90_days" | "more_than_90_days"
      wa_send_status: "queued" | "sent" | "delivered" | "read" | "failed"
      work_experience:
        | "fresher"
        | "<2_years"
        | "3-5_years"
        | "5-10_years"
        | "10+_years"
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
      account_type: ["individual", "business"],
      activity_type: [
        "note",
        "call",
        "email_sent",
        "email_opened",
        "wa_sent",
        "wa_delivered",
        "wa_read",
        "stage_change",
        "booking_created",
        "payment_received",
        "invoice_sent",
        "form_submitted",
      ],
      booking_outcome: [
        "qualified",
        "not_qualified",
        "needs_follow_up",
        "converted",
      ],
      booking_status: ["confirmed", "cancelled", "completed", "no_show"],
      campaign_status: ["draft", "active", "paused", "completed"],
      campaign_type: ["drip", "one_time", "newsletter"],
      contact_type: ["prospect", "customer", "lead"],
      email_send_status: [
        "queued",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "failed",
      ],
      financial_readiness: ["ready", "careful_but_open", "not_ready"],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      invoice_type: ["estimate", "invoice"],
      payment_gateway: ["cashfree", "stripe", "manual"],
      sales_type: [
        "vsl",
        "webinar",
        "workshop",
        "short_course",
        "direct_outreach",
        "custom",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "completed", "overdue", "cancelled"],
      task_type: ["follow_up", "call", "email", "general"],
      team_role: ["admin", "sales", "marketing", "viewer"],
      transaction_type: ["income", "expense"],
      urgency_level: ["right_now", "within_90_days", "more_than_90_days"],
      wa_send_status: ["queued", "sent", "delivered", "read", "failed"],
      work_experience: [
        "fresher",
        "<2_years",
        "3-5_years",
        "5-10_years",
        "10+_years",
      ],
    },
  },
} as const
