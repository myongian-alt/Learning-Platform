// Generated from the live Supabase schema:
//   npx supabase gen types typescript --project-id taehvowefldfuislimuf > src/types/database.ts
// Re-run this after any migration in supabase/migrations/. Convenience aliases
// at the bottom keep the rest of the app's imports (Profile, Assignment, ...)
// stable across regenerations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      assignment_pages: {
        Row: {
          assignment_id: string;
          created_at: string;
          id: string;
          position: number;
          source_type: Database['public']['Enums']['page_source_type'];
          source_url: string | null;
          title: string | null;
        };
        Insert: {
          assignment_id: string;
          created_at?: string;
          id?: string;
          position: number;
          source_type?: Database['public']['Enums']['page_source_type'];
          source_url?: string | null;
          title?: string | null;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          id?: string;
          position?: number;
          source_type?: Database['public']['Enums']['page_source_type'];
          source_url?: string | null;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'assignment_pages_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
        ];
      };
      assignments: {
        Row: {
          available_from: string | null;
          class_id: string;
          created_at: string;
          created_by: string;
          current_page_id: string | null;
          delivery_mode: Database['public']['Enums']['delivery_mode'];
          description: string | null;
          due_at: string | null;
          id: string;
          is_timed: boolean;
          standards: string[];
          status: Database['public']['Enums']['assignment_status'];
          time_limit_seconds: number | null;
          title: string;
          updated_at: string;
          week_number: number | null;
        };
        Insert: {
          available_from?: string | null;
          class_id: string;
          created_at?: string;
          created_by: string;
          current_page_id?: string | null;
          delivery_mode?: Database['public']['Enums']['delivery_mode'];
          description?: string | null;
          due_at?: string | null;
          id?: string;
          is_timed?: boolean;
          standards?: string[];
          status?: Database['public']['Enums']['assignment_status'];
          time_limit_seconds?: number | null;
          title: string;
          updated_at?: string;
          week_number?: number | null;
        };
        Update: {
          available_from?: string | null;
          class_id?: string;
          created_at?: string;
          created_by?: string;
          current_page_id?: string | null;
          delivery_mode?: Database['public']['Enums']['delivery_mode'];
          description?: string | null;
          due_at?: string | null;
          id?: string;
          is_timed?: boolean;
          standards?: string[];
          status?: Database['public']['Enums']['assignment_status'];
          time_limit_seconds?: number | null;
          title?: string;
          updated_at?: string;
          week_number?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'assignments_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_current_page_fk';
            columns: ['current_page_id'];
            isOneToOne: false;
            referencedRelation: 'assignment_pages';
            referencedColumns: ['id'];
          },
        ];
      };
      canvas_strokes: {
        Row: {
          author_id: string;
          author_role: Database['public']['Enums']['stroke_author_role'];
          color: string | null;
          created_at: string;
          id: string;
          page_id: string;
          points: Json;
          stroke_width: number | null;
          submission_id: string | null;
          tool: string;
        };
        Insert: {
          author_id: string;
          author_role: Database['public']['Enums']['stroke_author_role'];
          color?: string | null;
          created_at?: string;
          id?: string;
          page_id: string;
          points: Json;
          stroke_width?: number | null;
          submission_id?: string | null;
          tool: string;
        };
        Update: {
          author_id?: string;
          author_role?: Database['public']['Enums']['stroke_author_role'];
          color?: string | null;
          created_at?: string;
          id?: string;
          page_id?: string;
          points?: Json;
          stroke_width?: number | null;
          submission_id?: string | null;
          tool?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'canvas_strokes_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'canvas_strokes_page_id_fkey';
            columns: ['page_id'];
            isOneToOne: false;
            referencedRelation: 'assignment_pages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'canvas_strokes_submission_id_fkey';
            columns: ['submission_id'];
            isOneToOne: false;
            referencedRelation: 'submissions';
            referencedColumns: ['id'];
          },
        ];
      };
      class_members: {
        Row: {
          class_id: string;
          joined_at: string;
          student_id: string;
        };
        Insert: {
          class_id: string;
          joined_at?: string;
          student_id: string;
        };
        Update: {
          class_id?: string;
          joined_at?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'class_members_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'class_members_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      classes: {
        Row: {
          created_at: string;
          grade: string | null;
          id: string;
          join_code: string;
          name: string;
          organization_id: string | null;
          section: string[] | null;
          subject: string | null;
          teacher_id: string;
          term: string | null;
        };
        Insert: {
          created_at?: string;
          grade?: string | null;
          id?: string;
          join_code: string;
          name: string;
          organization_id?: string | null;
          section?: string[] | null;
          subject?: string | null;
          teacher_id: string;
          term?: string | null;
        };
        Update: {
          created_at?: string;
          grade?: string | null;
          id?: string;
          join_code?: string;
          name?: string;
          organization_id?: string | null;
          section?: string[] | null;
          subject?: string | null;
          teacher_id?: string;
          term?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'classes_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'classes_teacher_id_fkey';
            columns: ['teacher_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      co_teachers: {
        Row: {
          class_id: string;
          teacher_id: string;
        };
        Insert: {
          class_id: string;
          teacher_id: string;
        };
        Update: {
          class_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'co_teachers_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'co_teachers_teacher_id_fkey';
            columns: ['teacher_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      gradebook_custom_columns: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string;
          id: string;
          label: string;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          label: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          label?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gradebook_custom_columns_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gradebook_custom_columns_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      gradebook_custom_scores: {
        Row: {
          column_id: string;
          id: string;
          score: number | null;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          column_id: string;
          id?: string;
          score?: number | null;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          column_id?: string;
          id?: string;
          score?: number | null;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gradebook_custom_scores_column_id_fkey';
            columns: ['column_id'];
            isOneToOne: false;
            referencedRelation: 'gradebook_custom_columns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gradebook_custom_scores_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      gradebook_layouts: {
        Row: {
          class_id: string;
          column_order: Json;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          column_order?: Json;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          column_order?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gradebook_layouts_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: true;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
        ];
      };
      help_requests: {
        Row: {
          assignment_id: string;
          created_at: string;
          id: string;
          is_anonymous: boolean;
          page_id: string | null;
          resolved_at: string | null;
          status: Database['public']['Enums']['help_request_status'];
          student_id: string;
        };
        Insert: {
          assignment_id: string;
          created_at?: string;
          id?: string;
          is_anonymous?: boolean;
          page_id?: string | null;
          resolved_at?: string | null;
          status?: Database['public']['Enums']['help_request_status'];
          student_id: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          id?: string;
          is_anonymous?: boolean;
          page_id?: string | null;
          resolved_at?: string | null;
          status?: Database['public']['Enums']['help_request_status'];
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'help_requests_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'help_requests_page_id_fkey';
            columns: ['page_id'];
            isOneToOne: false;
            referencedRelation: 'assignment_pages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'help_requests_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      leaderboard_entries: {
        Row: {
          assignment_id: string;
          points: number;
          streak: number;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          assignment_id: string;
          points?: number;
          streak?: number;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          points?: number;
          streak?: number;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'leaderboard_entries_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leaderboard_entries_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_ai_resources: {
        Row: {
          created_at: string;
          error_message: string | null;
          generated_at: string | null;
          generated_by: string | null;
          id: string;
          khan_academy: Json | null;
          mcqs: Json | null;
          model: string | null;
          quizizz: Json | null;
          resource_id: string;
          status: Database['public']['Enums']['ai_resource_status'];
          topic_summary: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          generated_at?: string | null;
          generated_by?: string | null;
          id?: string;
          khan_academy?: Json | null;
          mcqs?: Json | null;
          model?: string | null;
          quizizz?: Json | null;
          resource_id: string;
          status?: Database['public']['Enums']['ai_resource_status'];
          topic_summary?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          generated_at?: string | null;
          generated_by?: string | null;
          id?: string;
          khan_academy?: Json | null;
          mcqs?: Json | null;
          model?: string | null;
          quizizz?: Json | null;
          resource_id?: string;
          status?: Database['public']['Enums']['ai_resource_status'];
          topic_summary?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_ai_resources_generated_by_fkey';
            columns: ['generated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lesson_ai_resources_resource_id_fkey';
            columns: ['resource_id'];
            isOneToOne: true;
            referencedRelation: 'lesson_resources';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_attached_tasks: {
        Row: {
          content: Json | null;
          created_at: string;
          created_by: string;
          id: string;
          kind: Database['public']['Enums']['lesson_task_kind'];
          position: number;
          resource_id: string;
        };
        Insert: {
          content?: Json | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          kind: Database['public']['Enums']['lesson_task_kind'];
          position: number;
          resource_id: string;
        };
        Update: {
          content?: Json | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          kind?: Database['public']['Enums']['lesson_task_kind'];
          position?: number;
          resource_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_attached_tasks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lesson_attached_tasks_resource_id_fkey';
            columns: ['resource_id'];
            isOneToOne: false;
            referencedRelation: 'lesson_resources';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_live_presence: {
        Row: {
          class_id: string;
          following_teacher: boolean;
          id: string;
          is_present: boolean;
          joined_at: string;
          last_event_type: string | null;
          last_seen_at: string;
          left_at: string | null;
          pacing_mode: Database['public']['Enums']['slide_pacing_mode'] | null;
          resource_id: string | null;
          slide_id: string | null;
          slide_index: number | null;
          student_id: string;
          submissions_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          following_teacher?: boolean;
          id?: string;
          is_present?: boolean;
          joined_at?: string;
          last_event_type?: string | null;
          last_seen_at?: string;
          left_at?: string | null;
          pacing_mode?: Database['public']['Enums']['slide_pacing_mode'] | null;
          resource_id?: string | null;
          slide_id?: string | null;
          slide_index?: number | null;
          student_id: string;
          submissions_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          following_teacher?: boolean;
          id?: string;
          is_present?: boolean;
          joined_at?: string;
          last_event_type?: string | null;
          last_seen_at?: string;
          left_at?: string | null;
          pacing_mode?: Database['public']['Enums']['slide_pacing_mode'] | null;
          resource_id?: string | null;
          slide_id?: string | null;
          slide_index?: number | null;
          student_id?: string;
          submissions_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_live_presence_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lesson_live_presence_resource_id_fkey';
            columns: ['resource_id'];
            isOneToOne: false;
            referencedRelation: 'lesson_resources';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lesson_live_presence_slide_id_fkey';
            columns: ['slide_id'];
            isOneToOne: false;
            referencedRelation: 'lesson_slides';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lesson_live_presence_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_resources: {
        Row: {
          class_id: string;
          conversion_status: Database['public']['Enums']['lesson_conversion_status'];
          created_at: string;
          file_type: Database['public']['Enums']['lesson_file_type'];
          id: string;
          is_live_session: boolean;
          lesson_number: number;
          size_bytes: number | null;
          storage_path: string | null;
          title: string;
          updated_at: string;
          week_number: number;
        };
        Insert: {
          class_id: string;
          conversion_status?: Database['public']['Enums']['lesson_conversion_status'];
          created_at?: string;
          file_type: Database['public']['Enums']['lesson_file_type'];
          id?: string;
          is_live_session?: boolean;
          lesson_number?: number;
          size_bytes?: number | null;
          storage_path?: string | null;
          title: string;
          updated_at?: string;
          week_number: number;
        };
        Update: {
          class_id?: string;
          conversion_status?: Database['public']['Enums']['lesson_conversion_status'];
          created_at?: string;
          file_type?: Database['public']['Enums']['lesson_file_type'];
          id?: string;
          is_live_session?: boolean;
          lesson_number?: number;
          size_bytes?: number | null;
          storage_path?: string | null;
          title?: string;
          updated_at?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_resources_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_slides: {
        Row: {
          activity_tag: Database['public']['Enums']['slide_activity_tag'] | null;
          annotations: Json;
          created_at: string;
          duration_minutes: number | null;
          grading_enabled: boolean;
          grading_mode: Database['public']['Enums']['slide_grading_mode'];
          id: string;
          objects: Json;
          pacing_mode: Database['public']['Enums']['slide_pacing_mode'];
          position: number;
          resource_id: string;
          storage_path: string | null;
          submissions_enabled: boolean;
          timer_command: string;
        };
        Insert: {
          activity_tag?: Database['public']['Enums']['slide_activity_tag'] | null;
          annotations?: Json;
          created_at?: string;
          duration_minutes?: number | null;
          grading_enabled?: boolean;
          grading_mode?: Database['public']['Enums']['slide_grading_mode'];
          id?: string;
          objects?: Json;
          pacing_mode?: Database['public']['Enums']['slide_pacing_mode'];
          position: number;
          resource_id: string;
          storage_path?: string | null;
          submissions_enabled?: boolean;
          timer_command?: string;
        };
        Update: {
          activity_tag?: Database['public']['Enums']['slide_activity_tag'] | null;
          annotations?: Json;
          created_at?: string;
          duration_minutes?: number | null;
          grading_enabled?: boolean;
          grading_mode?: Database['public']['Enums']['slide_grading_mode'];
          id?: string;
          objects?: Json;
          pacing_mode?: Database['public']['Enums']['slide_pacing_mode'];
          position?: number;
          resource_id?: string;
          storage_path?: string | null;
          submissions_enabled?: boolean;
          timer_command?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_slides_resource_id_fkey';
            columns: ['resource_id'];
            isOneToOne: false;
            referencedRelation: 'lesson_resources';
            referencedColumns: ['id'];
          },
        ];
      };
      library_items: {
        Row: {
          content: Json;
          created_at: string;
          description: string | null;
          embedding: string | null;
          id: string;
          is_public: boolean;
          organization_id: string | null;
          owner_id: string | null;
          standards: string[];
          title: string;
          type: Database['public']['Enums']['library_item_type'];
        };
        Insert: {
          content?: Json;
          created_at?: string;
          description?: string | null;
          embedding?: string | null;
          id?: string;
          is_public?: boolean;
          organization_id?: string | null;
          owner_id?: string | null;
          standards?: string[];
          title: string;
          type: Database['public']['Enums']['library_item_type'];
        };
        Update: {
          content?: Json;
          created_at?: string;
          description?: string | null;
          embedding?: string | null;
          id?: string;
          is_public?: boolean;
          organization_id?: string | null;
          owner_id?: string | null;
          standards?: string[];
          title?: string;
          type?: Database['public']['Enums']['library_item_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'library_items_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'library_items_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      lms_connections: {
        Row: {
          class_id: string;
          created_at: string;
          external_id: string;
          id: string;
          last_synced_at: string | null;
          provider: Database['public']['Enums']['lms_provider'];
        };
        Insert: {
          class_id: string;
          created_at?: string;
          external_id: string;
          id?: string;
          last_synced_at?: string | null;
          provider: Database['public']['Enums']['lms_provider'];
        };
        Update: {
          class_id?: string;
          created_at?: string;
          external_id?: string;
          id?: string;
          last_synced_at?: string | null;
          provider?: Database['public']['Enums']['lms_provider'];
        };
        Relationships: [
          {
            foreignKeyName: 'lms_connections_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
        ];
      };
      mcq_task_submissions: {
        Row: {
          answers: Json;
          correct_count: number;
          created_at: string;
          id: string;
          score: number;
          student_id: string;
          submitted_at: string | null;
          task_id: string;
          total_count: number;
          updated_at: string;
        };
        Insert: {
          answers?: Json;
          correct_count?: number;
          created_at?: string;
          id?: string;
          score?: number;
          student_id: string;
          submitted_at?: string | null;
          task_id: string;
          total_count?: number;
          updated_at?: string;
        };
        Update: {
          answers?: Json;
          correct_count?: number;
          created_at?: string;
          id?: string;
          score?: number;
          student_id?: string;
          submitted_at?: string | null;
          task_id?: string;
          total_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mcq_task_submissions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mcq_task_submissions_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'lesson_attached_tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      portfolio_files: {
        Row: {
          file_name: string;
          folder_id: string;
          id: string;
          mime_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          student_id: string;
          uploaded_at: string;
        };
        Insert: {
          file_name: string;
          folder_id: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          student_id: string;
          uploaded_at?: string;
        };
        Update: {
          file_name?: string;
          folder_id?: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          student_id?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'portfolio_files_folder_id_fkey';
            columns: ['folder_id'];
            isOneToOne: false;
            referencedRelation: 'portfolio_folders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portfolio_files_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      portfolio_folders: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          name: string;
          position: number;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          name: string;
          position?: number;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          name?: string;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'portfolio_folders_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'portfolio_folders_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string;
          id: string;
          organization_id: string | null;
          role: Database['public']['Enums']['user_role'];
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name: string;
          id: string;
          organization_id?: string | null;
          role?: Database['public']['Enums']['user_role'];
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          organization_id?: string | null;
          role?: Database['public']['Enums']['user_role'];
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      questions: {
        Row: {
          correct_answer: Json | null;
          created_at: string;
          id: string;
          options: Json;
          page_id: string;
          points: number;
          position: number;
          prompt: string;
          type: Database['public']['Enums']['question_type'];
        };
        Insert: {
          correct_answer?: Json | null;
          created_at?: string;
          id?: string;
          options?: Json;
          page_id: string;
          points?: number;
          position: number;
          prompt: string;
          type: Database['public']['Enums']['question_type'];
        };
        Update: {
          correct_answer?: Json | null;
          created_at?: string;
          id?: string;
          options?: Json;
          page_id?: string;
          points?: number;
          position?: number;
          prompt?: string;
          type?: Database['public']['Enums']['question_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'questions_page_id_fkey';
            columns: ['page_id'];
            isOneToOne: false;
            referencedRelation: 'assignment_pages';
            referencedColumns: ['id'];
          },
        ];
      };
      responses: {
        Row: {
          auto_score: number | null;
          created_at: string;
          id: string;
          is_correct: boolean | null;
          question_id: string;
          response_data: Json;
          submission_id: string;
          time_spent_seconds: number;
          updated_at: string;
        };
        Insert: {
          auto_score?: number | null;
          created_at?: string;
          id?: string;
          is_correct?: boolean | null;
          question_id: string;
          response_data?: Json;
          submission_id: string;
          time_spent_seconds?: number;
          updated_at?: string;
        };
        Update: {
          auto_score?: number | null;
          created_at?: string;
          id?: string;
          is_correct?: boolean | null;
          question_id?: string;
          response_data?: Json;
          submission_id?: string;
          time_spent_seconds?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'responses_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'responses_submission_id_fkey';
            columns: ['submission_id'];
            isOneToOne: false;
            referencedRelation: 'submissions';
            referencedColumns: ['id'];
          },
        ];
      };
      slide_submissions: {
        Row: {
          annotations: Json;
          answers: Json;
          feedback: string | null;
          grade: number | null;
          id: string;
          objects: Json;
          slide_id: string;
          student_id: string;
          submitted_at: string | null;
          teacher_annotations: Json;
          teacher_comment: string | null;
          updated_at: string;
        };
        Insert: {
          annotations?: Json;
          answers?: Json;
          feedback?: string | null;
          grade?: number | null;
          id?: string;
          objects?: Json;
          slide_id: string;
          student_id: string;
          submitted_at?: string | null;
          teacher_annotations?: Json;
          teacher_comment?: string | null;
          updated_at?: string;
        };
        Update: {
          annotations?: Json;
          answers?: Json;
          feedback?: string | null;
          grade?: number | null;
          id?: string;
          objects?: Json;
          slide_id?: string;
          student_id?: string;
          submitted_at?: string | null;
          teacher_annotations?: Json;
          teacher_comment?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'slide_submissions_slide_id_fkey';
            columns: ['slide_id'];
            isOneToOne: false;
            referencedRelation: 'lesson_slides';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'slide_submissions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      standards: {
        Row: {
          code: string;
          description: string;
          id: string;
          subject: string | null;
        };
        Insert: {
          code: string;
          description: string;
          id?: string;
          subject?: string | null;
        };
        Update: {
          code?: string;
          description?: string;
          id?: string;
          subject?: string | null;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          assignment_id: string;
          created_at: string;
          id: string;
          score: number | null;
          started_at: string | null;
          status: Database['public']['Enums']['submission_status'];
          student_id: string;
          submitted_at: string | null;
          teacher_feedback: string | null;
          updated_at: string;
        };
        Insert: {
          assignment_id: string;
          created_at?: string;
          id?: string;
          score?: number | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['submission_status'];
          student_id: string;
          submitted_at?: string | null;
          teacher_feedback?: string | null;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          id?: string;
          score?: number | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['submission_status'];
          student_id?: string;
          submitted_at?: string | null;
          teacher_feedback?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'submissions_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      find_class_id_by_join_code: { Args: { code: string }; Returns: string };
      set_live_lesson_resource: {
        Args: { make_live: boolean; target_resource_id: string };
        Returns: undefined;
      };
      upsert_teacher_slide_overlay: {
        Args: {
          next_feedback?: string;
          next_grade?: number;
          next_teacher_annotations?: Json;
          next_teacher_comment?: string;
          target_slide_id: string;
          target_student_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      ai_resource_status: 'pending' | 'ready' | 'failed';
      assignment_status: 'draft' | 'published' | 'archived';
      delivery_mode: 'teacher_paced' | 'student_paced' | 'front_of_class';
      help_request_status: 'open' | 'acknowledged' | 'resolved';
      lesson_conversion_status: 'none' | 'pending' | 'ready' | 'failed';
      lesson_file_type: 'pdf' | 'pptx' | 'docx' | 'image' | 'video' | 'link';
      lesson_task_kind:
        'quiz' | 'assignment' | 'project' | 'khan_academy_video' | 'quizizz_quiz' | 'custom_mcqs';
      library_item_type: 'quiz' | 'lesson' | 'activity' | 'video';
      lms_provider: 'google_classroom' | 'canvas' | 'schoology' | 'clever';
      page_source_type: 'blank_canvas' | 'pdf' | 'image' | 'slide' | 'video' | 'question' | 'link';
      question_type:
        | 'multiple_choice'
        | 'true_false'
        | 'short_answer'
        | 'fill_blank'
        | 'open_ended'
        | 'draw'
        | 'audio_response'
        | 'video_response'
        | 'drag_drop'
        | 'matching'
        | 'graphing'
        | 'hotspot'
        | 'labeling'
        | 'reorder'
        | 'poll';
      slide_activity_tag:
        | 'title_objectives'
        | 'warm_up'
        | 'main_idea'
        | 'solved_examples'
        | 'guided_practice'
        | 'independent_activity'
        | 'group_activity'
        | 'challenge_extra'
        | 'exit_ticket';
      slide_grading_mode: 'auto' | 'manual';
      slide_pacing_mode: 'teacher_paced' | 'student_paced';
      stroke_author_role: 'student' | 'teacher';
      submission_status: 'not_started' | 'in_progress' | 'submitted' | 'graded';
      user_role: 'teacher' | 'student' | 'admin';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ai_resource_status: ['pending', 'ready', 'failed'],
      assignment_status: ['draft', 'published', 'archived'],
      delivery_mode: ['teacher_paced', 'student_paced', 'front_of_class'],
      help_request_status: ['open', 'acknowledged', 'resolved'],
      lesson_conversion_status: ['none', 'pending', 'ready', 'failed'],
      lesson_file_type: ['pdf', 'pptx', 'docx', 'image', 'video', 'link'],
      lesson_task_kind: [
        'quiz',
        'assignment',
        'project',
        'khan_academy_video',
        'quizizz_quiz',
        'custom_mcqs',
      ],
      library_item_type: ['quiz', 'lesson', 'activity', 'video'],
      lms_provider: ['google_classroom', 'canvas', 'schoology', 'clever'],
      page_source_type: ['blank_canvas', 'pdf', 'image', 'slide', 'video', 'question', 'link'],
      question_type: [
        'multiple_choice',
        'true_false',
        'short_answer',
        'fill_blank',
        'open_ended',
        'draw',
        'audio_response',
        'video_response',
        'drag_drop',
        'matching',
        'graphing',
        'hotspot',
        'labeling',
        'reorder',
        'poll',
      ],
      slide_activity_tag: [
        'title_objectives',
        'warm_up',
        'main_idea',
        'solved_examples',
        'guided_practice',
        'independent_activity',
        'group_activity',
        'challenge_extra',
        'exit_ticket',
      ],
      slide_grading_mode: ['auto', 'manual'],
      slide_pacing_mode: ['teacher_paced', 'student_paced'],
      stroke_author_role: ['student', 'teacher'],
      submission_status: ['not_started', 'in_progress', 'submitted', 'graded'],
      user_role: ['teacher', 'student', 'admin'],
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Convenience aliases used across the app — kept stable across regenerations.
// ---------------------------------------------------------------------------

export type UserRole = Enums<'user_role'>;
export type DeliveryMode = Enums<'delivery_mode'>;
export type AssignmentStatus = Enums<'assignment_status'>;
export type PageSourceType = Enums<'page_source_type'>;
export type QuestionType = Enums<'question_type'>;
export type SubmissionStatus = Enums<'submission_status'>;
export type StrokeAuthorRole = Enums<'stroke_author_role'>;
export type HelpRequestStatus = Enums<'help_request_status'>;
export type LibraryItemType = Enums<'library_item_type'>;
export type LmsProvider = Enums<'lms_provider'>;
export type LessonFileType = Enums<'lesson_file_type'>;
export type LessonTaskKind = Enums<'lesson_task_kind'>;
export type LessonConversionStatus = Enums<'lesson_conversion_status'>;
export type SlideActivityTag = Enums<'slide_activity_tag'>;
export type SlidePacingMode = Enums<'slide_pacing_mode'>;
export type SlideGradingMode = Enums<'slide_grading_mode'>;
export type AiResourceStatus = Enums<'ai_resource_status'>;

export type StrokePoint = {
  x: number;
  y: number;
  pressure?: number;
};

export type Profile = Tables<'profiles'>;
export type ClassRow = Tables<'classes'>;
export type ClassMember = Tables<'class_members'>;
export type Assignment = Tables<'assignments'>;
export type AssignmentPage = Tables<'assignment_pages'>;
export type Question = Tables<'questions'>;
export type Submission = Tables<'submissions'>;
export type ResponseRow = Tables<'responses'>;
export type CanvasStroke = Tables<'canvas_strokes'>;
export type HelpRequest = Tables<'help_requests'>;
export type Standard = Tables<'standards'>;
export type LibraryItem = Tables<'library_items'>;
export type LeaderboardEntry = Tables<'leaderboard_entries'>;
export type LmsConnection = Tables<'lms_connections'>;
export type LessonResource = Tables<'lesson_resources'>;
export type LessonSlide = Tables<'lesson_slides'>;
export type LessonAttachedTask = Tables<'lesson_attached_tasks'>;
export type LessonLivePresence = Tables<'lesson_live_presence'>;
export type SlideSubmission = Tables<'slide_submissions'>;
export type LessonAiResources = Tables<'lesson_ai_resources'>;
export type McqTaskSubmission = Tables<'mcq_task_submissions'>;
export type GradebookCustomColumn = Tables<'gradebook_custom_columns'>;
export type GradebookCustomScore = Tables<'gradebook_custom_scores'>;
export type GradebookLayout = Tables<'gradebook_layouts'>;
export type PortfolioFolder = Tables<'portfolio_folders'>;
export type PortfolioFile = Tables<'portfolio_files'>;
