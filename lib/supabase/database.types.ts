export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      admin_users: Table<{ user_id: string; created_at: string; is_active: boolean }, { user_id: string; is_active?: boolean }, { is_active?: boolean }>
      projects: Table<{ id: string; slug: string; category: string; status: 'draft' | 'published'; featured: boolean; display_order: number; project_url: string | null; github_url: string | null; start_date: string | null; end_date: string | null; created_at: string; updated_at: string }, { id?: string; slug: string; category?: string; status?: 'draft' | 'published'; featured?: boolean; display_order?: number; project_url?: string | null; github_url?: string | null; start_date?: string | null; end_date?: string | null }, { slug?: string; category?: string; status?: 'draft' | 'published'; featured?: boolean; display_order?: number; project_url?: string | null; github_url?: string | null; start_date?: string | null; end_date?: string | null }>
      project_translations: Table<{ id: string; project_id: string; locale: 'id' | 'en'; title: string; short_description: string; description: string; role: string; period_label: string; mark: string; scope: string[]; seo_title: string | null; seo_description: string | null; created_at: string; updated_at: string }, { id?: string; project_id: string; locale: 'id' | 'en'; title: string; short_description: string; description: string; role?: string; period_label?: string; mark?: string; scope?: string[]; seo_title?: string | null; seo_description?: string | null }, { title?: string; short_description?: string; description?: string; role?: string; period_label?: string; mark?: string; scope?: string[]; seo_title?: string | null; seo_description?: string | null }>
      project_media: Table<{ id: string; project_id: string; storage_path: string; media_type: 'cover' | 'gallery'; alt_text_id: string; alt_text_en: string; caption_id: string | null; caption_en: string | null; display_order: number; created_at: string }, { id?: string; project_id: string; storage_path: string; media_type: 'cover' | 'gallery'; alt_text_id?: string; alt_text_en?: string; caption_id?: string | null; caption_en?: string | null; display_order?: number }, { storage_path?: string; media_type?: 'cover' | 'gallery'; alt_text_id?: string; alt_text_en?: string; caption_id?: string | null; caption_en?: string | null; display_order?: number }>
      experiences: Table<{ id: string; kind: 'work' | 'organization'; display_order: number; period_label: string; is_published: boolean; created_at: string; updated_at: string }, { id?: string; kind: 'work' | 'organization'; display_order?: number; period_label?: string; is_published?: boolean }, { kind?: 'work' | 'organization'; display_order?: number; period_label?: string; is_published?: boolean }>
      experience_translations: Table<{ id: string; experience_id: string; locale: 'id' | 'en'; title: string; description: string }, { id?: string; experience_id: string; locale: 'id' | 'en'; title: string; description?: string }, { title?: string; description?: string }>
      education: Table<{ id: string; title: string; detail_id: string; detail_en: string; period_label: string; display_order: number; is_published: boolean; created_at: string; updated_at: string }, { id?: string; title: string; detail_id?: string; detail_en?: string; period_label?: string; display_order?: number; is_published?: boolean }, { title?: string; detail_id?: string; detail_en?: string; period_label?: string; display_order?: number; is_published?: boolean }>
      site_content: Table<{ id: string; content_key: string; locale: 'id' | 'en'; value: string; updated_at: string }, { id?: string; content_key: string; locale: 'id' | 'en'; value?: string }, { value?: string }>
      site_settings: Table<{ setting_key: string; value: string; updated_at: string }, { setting_key: string; value?: string }, { value?: string }>
    }
    Views: Record<string, never>
    Functions: {
      is_portfolio_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      save_project_bundle: { Args: { p_project: Json; p_translations: Json; p_media: Json }; Returns: string }
      save_site_content_bundle: { Args: { p_settings: Json; p_values: Json; p_education: Json; p_organizations: Json }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
