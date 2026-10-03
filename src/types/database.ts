import type { StripeConnectionRow, CheckoutRow } from './stripe'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      stripe_checkout_requests: {
        Row: CheckoutRow
        Insert: Partial<CheckoutRow>
        Update: Partial<CheckoutRow>
        Relationships: []
      }
      stripe_connected_accounts: {
        Row: StripeConnectionRow
        Insert: Partial<StripeConnectionRow> & Pick<StripeConnectionRow, 'user_id'>
        Update: Partial<StripeConnectionRow>
        Relationships: []
      }
      stripe_connect_events: {
        Row: { id: string; stripe_account_id: string; fingerprint: string; event_created: number; received_at: string }
        Insert: { id: string; stripe_account_id: string; fingerprint: string; event_created: number; received_at?: string }
        Update: Record<string, never>
        Relationships: []
      }
      articles: {
        Row: {
          id: string
          title: string
          slug: string
          summary: string | null
          content: string
          cover_url: string | null
          og_image_url: string | null
          published_at: string
          read_time_minutes: number
          meta: Json | null
          author_id: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      article_tags: {
        Row: {
          article_id: string
          tag_id: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      products: {
        Row: {
          id: string
          stripe_product_id: string | null
          title: string
          slug: string
          description: string | null
          product_type: 'course' | 'membership' | 'roadmap'
          access_type: 'one_time' | 'subscription'
          price_cents: number
          currency: string
          active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      prices: {
        Row: {
          id: string
          product_id: string
          stripe_price_id: string
          amount_cents: number
          currency: string
          interval: 'day' | 'week' | 'month' | 'year' | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          user_id: string | null
          product_id: string
          price_id: string
          stripe_session_id: string | null
          stripe_payment_intent_id: string | null
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          total_cents: number
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          product_id: string
          price_id: string
          stripe_subscription_id: string
          stripe_customer_id: string
          status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          trial_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {
      authors: {
        Row: {
          id: string
          display_name: string
          avatar_url: string | null
          bio: string | null
          website_url: string | null
          twitter: string | null
          linkedin: string | null
        }
        Relationships: []
      }
      public_articles: {
        Row: {
          id: string
          title: string
          slug: string
          summary: string | null
          cover_url: string | null
          og_image_url: string | null
          published_at: string
          read_time_minutes: number
          author_id: string
          author_name: string | null
          author_avatar: string | null
          tags: Json | null
        }
        Relationships: []
      }
      featured_articles: {
        Row: {
          id: string
          title: string
          slug: string
          summary: string | null
          cover_url: string | null
          og_image_url: string | null
          published_at: string
          read_time_minutes: number
          author_id: string
          author_name: string | null
          author_avatar: string | null
          tags: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      reserve_stripe_connection: { Args: { p_user_id: string }; Returns: StripeConnectionRow[] }
      claim_stripe_connection: { Args: { p_user_id: string }; Returns: StripeConnectionRow[] }
      reserve_stripe_checkout: { Args: { p_user_id: string; p_price_id: string; p_request_id: string }; Returns: CheckoutRow[] }
      claim_stripe_checkout: { Args: { p_user_id: string; p_id: string }; Returns: CheckoutRow[] }
      record_stripe_checkout_event: {
        Args: { p_event_id: string; p_fingerprint: string; p_checkout_id: string; p_user_id: string; p_session_id: string; p_amount: number; p_currency: string; p_state: string }
        Returns: boolean
      }
      record_stripe_connect_event: {
        Args: { p_event_id: string; p_account_id: string; p_fingerprint: string; p_created: number }
        Returns: boolean
      }
      can_access_product: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      has_active_subscription: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      has_purchased: {
        Args: { p_product_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
