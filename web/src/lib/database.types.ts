// Hand-written to match supabase/migrations/0001_init.sql.
// Once the project is linked to a real Supabase instance, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; email: string; created_at: string };
        Insert: { id: string; display_name: string; email: string; created_at?: string };
        Update: { display_name?: string; email?: string };
        Relationships: [];
      };
      lists: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          occasion: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          occasion?: string | null;
          created_at?: string;
        };
        Update: { name?: string; occasion?: string | null };
        Relationships: [];
      };
      list_members: {
        Row: {
          id: string;
          list_id: string;
          user_id: string | null;
          invited_email: string | null;
          role: "owner" | "editor" | "viewer";
          status: "pending" | "accepted";
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          user_id?: string | null;
          invited_email?: string | null;
          role: "owner" | "editor" | "viewer";
          status?: "pending" | "accepted";
          created_at?: string;
        };
        Update: { user_id?: string | null; status?: "pending" | "accepted" };
        Relationships: [];
      };
      list_items: {
        Row: {
          id: string;
          list_id: string;
          added_by: string;
          product_url: string;
          title: string | null;
          image_url: string | null;
          retailer: string | null;
          current_price: number | null;
          target_price: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          added_by: string;
          product_url: string;
          title?: string | null;
          image_url?: string | null;
          retailer?: string | null;
          current_price?: number | null;
          target_price?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string | null;
          current_price?: number | null;
          target_price?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      item_claims: {
        Row: { id: string; item_id: string; claimed_by: string; created_at: string };
        Insert: { id?: string; item_id: string; claimed_by: string; created_at?: string };
        Update: { item_id?: string; claimed_by?: string };
        Relationships: [];
      };
      price_checks: {
        Row: { id: string; item_id: string; price: number; checked_at: string };
        Insert: { id?: string; item_id: string; price: number; checked_at?: string };
        Update: { item_id?: string; price?: number };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: { endpoint?: string; p256dh?: string; auth?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
