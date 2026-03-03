// Generated from supabase/migrations/001_initial_schema.sql
// Re-generate with: npx supabase gen types --lang=typescript --project-id <id>

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      team_members: {
        Row: {
          id: string;
          auth_user_id: string | null;
          name: string;
          email: string;
          phone: string | null;
          role: Database["public"]["Enums"]["team_role"];
          avatar_url: string | null;
          google_calendar_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          name: string;
          email: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["team_role"];
          avatar_url?: string | null;
          google_calendar_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          name?: string;
          email?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["team_role"];
          avatar_url?: string | null;
          google_calendar_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          gst_number: string | null;
          website: string | null;
          industry: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          gst_number?: string | null;
          website?: string | null;
          industry?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          gst_number?: string | null;
          website?: string | null;
          industry?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      funnels: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sales_type: Database["public"]["Enums"]["sales_type"];
          is_default: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sales_type?: Database["public"]["Enums"]["sales_type"];
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          sales_type?: Database["public"]["Enums"]["sales_type"];
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      funnel_stages: {
        Row: {
          id: string;
          funnel_id: string;
          name: string;
          order: number;
          color: string;
          is_terminal: boolean;
          auto_action: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          funnel_id: string;
          name: string;
          order: number;
          color?: string;
          is_terminal?: boolean;
          auto_action?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          funnel_id?: string;
          name?: string;
          order?: number;
          color?: string;
          is_terminal?: boolean;
          auto_action?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey";
            columns: ["funnel_id"];
            isOneToOne: false;
            referencedRelation: "funnels";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          id: string;
          type: Database["public"]["Enums"]["contact_type"];
          account_type: Database["public"]["Enums"]["account_type"];
          first_name: string;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          linkedin_url: string | null;
          source: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_term: string | null;
          assigned_to: string | null;
          funnel_id: string | null;
          current_stage_id: string | null;
          tags: string[];
          company_name: string | null;
          company_id: string | null;
          created_at: string;
          updated_at: string;
          converted_at: string | null;
          deleted_at: string | null;
          metadata: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          type?: Database["public"]["Enums"]["contact_type"];
          account_type?: Database["public"]["Enums"]["account_type"];
          first_name: string;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          source?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
          assigned_to?: string | null;
          funnel_id?: string | null;
          current_stage_id?: string | null;
          tags?: string[];
          company_name?: string | null;
          company_id?: string | null;
          created_at?: string;
          updated_at?: string;
          converted_at?: string | null;
          deleted_at?: string | null;
          metadata?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          type?: Database["public"]["Enums"]["contact_type"];
          account_type?: Database["public"]["Enums"]["account_type"];
          first_name?: string;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          source?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
          assigned_to?: string | null;
          funnel_id?: string | null;
          current_stage_id?: string | null;
          tags?: string[];
          company_name?: string | null;
          company_id?: string | null;
          created_at?: string;
          updated_at?: string;
          converted_at?: string | null;
          deleted_at?: string | null;
          metadata?: Record<string, unknown> | null;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_funnel_id_fkey";
            columns: ["funnel_id"];
            isOneToOne: false;
            referencedRelation: "funnels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_current_stage_id_fkey";
            columns: ["current_stage_id"];
            isOneToOne: false;
            referencedRelation: "funnel_stages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_form_responses: {
        Row: {
          id: string;
          contact_id: string;
          booking_id: string | null;
          work_experience: Database["public"]["Enums"]["work_experience"] | null;
          current_role: string | null;
          key_challenge: string | null;
          desired_salary: string | null;
          blocker: string | null;
          financial_readiness: Database["public"]["Enums"]["financial_readiness"] | null;
          urgency: Database["public"]["Enums"]["urgency_level"] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          booking_id?: string | null;
          work_experience?: Database["public"]["Enums"]["work_experience"] | null;
          current_role?: string | null;
          key_challenge?: string | null;
          desired_salary?: string | null;
          blocker?: string | null;
          financial_readiness?: Database["public"]["Enums"]["financial_readiness"] | null;
          urgency?: Database["public"]["Enums"]["urgency_level"] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          booking_id?: string | null;
          work_experience?: Database["public"]["Enums"]["work_experience"] | null;
          current_role?: string | null;
          key_challenge?: string | null;
          desired_salary?: string | null;
          blocker?: string | null;
          financial_readiness?: Database["public"]["Enums"]["financial_readiness"] | null;
          urgency?: Database["public"]["Enums"]["urgency_level"] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_form_responses_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_form_responses_booking";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      activities: {
        Row: {
          id: string;
          contact_id: string;
          user_id: string | null;
          type: Database["public"]["Enums"]["activity_type"];
          title: string;
          body: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          user_id?: string | null;
          type: Database["public"]["Enums"]["activity_type"];
          title: string;
          body?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          user_id?: string | null;
          type?: Database["public"]["Enums"]["activity_type"];
          title?: string;
          body?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          contact_id: string | null;
          assigned_to: string | null;
          title: string;
          description: string | null;
          due_at: string | null;
          priority: Database["public"]["Enums"]["task_priority"];
          status: Database["public"]["Enums"]["task_status"];
          type: Database["public"]["Enums"]["task_type"];
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          assigned_to?: string | null;
          title: string;
          description?: string | null;
          due_at?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          type?: Database["public"]["Enums"]["task_type"];
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          assigned_to?: string | null;
          title?: string;
          description?: string | null;
          due_at?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          type?: Database["public"]["Enums"]["task_type"];
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: {
          id: string;
          name: string;
          subject: string;
          body_html: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subject: string;
          body_html: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          subject?: string;
          body_html?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_campaigns: {
        Row: {
          id: string;
          name: string;
          type: Database["public"]["Enums"]["campaign_type"];
          status: Database["public"]["Enums"]["campaign_status"];
          trigger_event: string | null;
          stop_condition: Json | null;
          audience_filter: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: Database["public"]["Enums"]["campaign_type"];
          status?: Database["public"]["Enums"]["campaign_status"];
          trigger_event?: string | null;
          stop_condition?: Json | null;
          audience_filter?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: Database["public"]["Enums"]["campaign_type"];
          status?: Database["public"]["Enums"]["campaign_status"];
          trigger_event?: string | null;
          stop_condition?: Json | null;
          audience_filter?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_steps: {
        Row: {
          id: string;
          campaign_id: string;
          order: number;
          delay_hours: number;
          subject: string;
          body_html: string;
          condition: Json | null;
          template_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          order: number;
          delay_hours?: number;
          subject: string;
          body_html: string;
          condition?: Json | null;
          template_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          order?: number;
          delay_hours?: number;
          subject?: string;
          body_html?: string;
          condition?: Json | null;
          template_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_steps_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "email_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_steps_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      email_sends: {
        Row: {
          id: string;
          contact_id: string;
          campaign_id: string | null;
          step_id: string | null;
          status: Database["public"]["Enums"]["email_send_status"];
          resend_message_id: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          campaign_id?: string | null;
          step_id?: string | null;
          status?: Database["public"]["Enums"]["email_send_status"];
          resend_message_id?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          campaign_id?: string | null;
          step_id?: string | null;
          status?: Database["public"]["Enums"]["email_send_status"];
          resend_message_id?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_sends_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_sends_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "email_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_sends_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "email_steps";
            referencedColumns: ["id"];
          },
        ];
      };
      wa_templates: {
        Row: {
          id: string;
          name: string;
          language: string;
          category: string | null;
          body_text: string | null;
          header_text: string | null;
          footer_text: string | null;
          buttons: Json | null;
          meta_template_id: string | null;
          status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          language?: string;
          category?: string | null;
          body_text?: string | null;
          header_text?: string | null;
          footer_text?: string | null;
          buttons?: Json | null;
          meta_template_id?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          language?: string;
          category?: string | null;
          body_text?: string | null;
          header_text?: string | null;
          footer_text?: string | null;
          buttons?: Json | null;
          meta_template_id?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wa_campaigns: {
        Row: {
          id: string;
          name: string;
          type: Database["public"]["Enums"]["campaign_type"];
          status: Database["public"]["Enums"]["campaign_status"];
          trigger_event: string | null;
          stop_condition: Json | null;
          audience_filter: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: Database["public"]["Enums"]["campaign_type"];
          status?: Database["public"]["Enums"]["campaign_status"];
          trigger_event?: string | null;
          stop_condition?: Json | null;
          audience_filter?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: Database["public"]["Enums"]["campaign_type"];
          status?: Database["public"]["Enums"]["campaign_status"];
          trigger_event?: string | null;
          stop_condition?: Json | null;
          audience_filter?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wa_steps: {
        Row: {
          id: string;
          campaign_id: string;
          order: number;
          delay_hours: number;
          wa_template_name: string;
          wa_template_params: Json;
          condition: Json | null;
          template_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          order: number;
          delay_hours?: number;
          wa_template_name: string;
          wa_template_params?: Json;
          condition?: Json | null;
          template_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          order?: number;
          delay_hours?: number;
          wa_template_name?: string;
          wa_template_params?: Json;
          condition?: Json | null;
          template_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wa_steps_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "wa_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wa_steps_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "wa_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      wa_sends: {
        Row: {
          id: string;
          contact_id: string;
          campaign_id: string | null;
          step_id: string | null;
          status: Database["public"]["Enums"]["wa_send_status"];
          wa_message_id: string | null;
          delivered_at: string | null;
          read_at: string | null;
          replied: boolean;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          campaign_id?: string | null;
          step_id?: string | null;
          status?: Database["public"]["Enums"]["wa_send_status"];
          wa_message_id?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          replied?: boolean;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          campaign_id?: string | null;
          step_id?: string | null;
          status?: Database["public"]["Enums"]["wa_send_status"];
          wa_message_id?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          replied?: boolean;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wa_sends_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wa_sends_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "wa_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wa_sends_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "wa_steps";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_pages: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          duration_minutes: number;
          form_fields: Json;
          availability_rules: Json;
          google_calendar_id: string | null;
          assigned_to: string[];
          confirmation_email: boolean;
          confirmation_wa: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          duration_minutes?: number;
          form_fields?: Json;
          availability_rules?: Json;
          google_calendar_id?: string | null;
          assigned_to?: string[];
          confirmation_email?: boolean;
          confirmation_wa?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          duration_minutes?: number;
          form_fields?: Json;
          availability_rules?: Json;
          google_calendar_id?: string | null;
          assigned_to?: string[];
          confirmation_email?: boolean;
          confirmation_wa?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          booking_page_id: string | null;
          contact_id: string;
          assigned_to: string | null;
          starts_at: string;
          ends_at: string;
          status: Database["public"]["Enums"]["booking_status"];
          google_event_id: string | null;
          meet_link: string | null;
          notes: string | null;
          outcome: Database["public"]["Enums"]["booking_outcome"] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_page_id?: string | null;
          contact_id: string;
          assigned_to?: string | null;
          starts_at: string;
          ends_at: string;
          status?: Database["public"]["Enums"]["booking_status"];
          google_event_id?: string | null;
          meet_link?: string | null;
          notes?: string | null;
          outcome?: Database["public"]["Enums"]["booking_outcome"] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_page_id?: string | null;
          contact_id?: string;
          assigned_to?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          google_event_id?: string | null;
          meet_link?: string | null;
          notes?: string | null;
          outcome?: Database["public"]["Enums"]["booking_outcome"] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_booking_page_id_fkey";
            columns: ["booking_page_id"];
            isOneToOne: false;
            referencedRelation: "booking_pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          contact_id: string;
          type: Database["public"]["Enums"]["invoice_type"];
          status: Database["public"]["Enums"]["invoice_status"];
          items: Json;
          subtotal: number;
          gst_rate: number | null;
          gst_amount: number | null;
          total: number;
          gst_number: string | null;
          due_date: string | null;
          payment_gateway: Database["public"]["Enums"]["payment_gateway"] | null;
          payment_link: string | null;
          payment_id: string | null;
          paid_at: string | null;
          is_recurring: boolean;
          recurrence_day: number | null;
          pdf_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          contact_id: string;
          type?: Database["public"]["Enums"]["invoice_type"];
          status?: Database["public"]["Enums"]["invoice_status"];
          items?: Json;
          subtotal?: number;
          gst_rate?: number | null;
          gst_amount?: number | null;
          total?: number;
          gst_number?: string | null;
          due_date?: string | null;
          payment_gateway?: Database["public"]["Enums"]["payment_gateway"] | null;
          payment_link?: string | null;
          payment_id?: string | null;
          paid_at?: string | null;
          is_recurring?: boolean;
          recurrence_day?: number | null;
          pdf_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          contact_id?: string;
          type?: Database["public"]["Enums"]["invoice_type"];
          status?: Database["public"]["Enums"]["invoice_status"];
          items?: Json;
          subtotal?: number;
          gst_rate?: number | null;
          gst_amount?: number | null;
          total?: number;
          gst_number?: string | null;
          due_date?: string | null;
          payment_gateway?: Database["public"]["Enums"]["payment_gateway"] | null;
          payment_link?: string | null;
          payment_id?: string | null;
          paid_at?: string | null;
          is_recurring?: boolean;
          recurrence_day?: number | null;
          pdf_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          type: Database["public"]["Enums"]["transaction_type"];
          category: string;
          amount: number;
          description: string | null;
          invoice_id: string | null;
          contact_id: string | null;
          date: string;
          gst_applicable: boolean;
          receipt_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: Database["public"]["Enums"]["transaction_type"];
          category: string;
          amount: number;
          description?: string | null;
          invoice_id?: string | null;
          contact_id?: string | null;
          date?: string;
          gst_applicable?: boolean;
          receipt_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: Database["public"]["Enums"]["transaction_type"];
          category?: string;
          amount?: number;
          description?: string | null;
          invoice_id?: string | null;
          contact_id?: string | null;
          date?: string;
          gst_applicable?: boolean;
          receipt_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string | null;
          read: boolean;
          link: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body?: string | null;
          read?: boolean;
          link?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string | null;
          read?: boolean;
          link?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_programs: {
        Row: {
          id: string;
          contact_id: string;
          program_name: string;
          start_date: string | null;
          end_date: string | null;
          sessions_total: number | null;
          sessions_completed: number;
          mentor_id: string | null;
          status: string | null;
          amount: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          program_name: string;
          start_date?: string | null;
          end_date?: string | null;
          sessions_total?: number | null;
          sessions_completed?: number;
          mentor_id?: string | null;
          status?: string | null;
          amount?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          program_name?: string;
          start_date?: string | null;
          end_date?: string | null;
          sessions_total?: number | null;
          sessions_completed?: number;
          mentor_id?: string | null;
          status?: string | null;
          amount?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_programs_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_programs_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          id: string;
          contact_id: string | null;
          uploaded_by: string | null;
          file_name: string;
          file_type: string | null;
          file_size: number | null;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          uploaded_by?: string | null;
          file_name: string;
          file_type?: string | null;
          file_size?: number | null;
          storage_path: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          uploaded_by?: string | null;
          file_name?: string;
          file_type?: string | null;
          file_size?: number | null;
          storage_path?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "team_members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      contact_type: "prospect" | "customer" | "lead";
      account_type: "individual" | "business";
      work_experience: "fresher" | "<2_years" | "3-5_years" | "5-10_years" | "10+_years";
      financial_readiness: "ready" | "careful_but_open" | "not_ready";
      urgency_level: "right_now" | "within_90_days" | "more_than_90_days";
      sales_type: "vsl" | "webinar" | "workshop" | "short_course" | "direct_outreach" | "custom";
      activity_type: "note" | "call" | "email_sent" | "email_opened" | "wa_sent" | "wa_delivered" | "wa_read" | "stage_change" | "booking_created" | "payment_received" | "invoice_sent" | "form_submitted";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "pending" | "completed" | "overdue" | "cancelled";
      task_type: "follow_up" | "call" | "email" | "general";
      campaign_type: "drip" | "one_time" | "newsletter";
      campaign_status: "draft" | "active" | "paused" | "completed";
      email_send_status: "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed";
      wa_send_status: "queued" | "sent" | "delivered" | "read" | "failed";
      booking_status: "confirmed" | "cancelled" | "completed" | "no_show";
      booking_outcome: "qualified" | "not_qualified" | "needs_follow_up" | "converted";
      invoice_type: "estimate" | "invoice";
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
      payment_gateway: "cashfree" | "stripe" | "manual";
      transaction_type: "income" | "expense";
      team_role: "admin" | "sales" | "marketing" | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Helper types for cleaner imports
type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;
