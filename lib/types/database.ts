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
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          role: "admin" | "operator";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          role?: "admin" | "operator";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          role?: "admin" | "operator";
          created_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          price_type: "minorista" | "mayorista" | "otra";
          notes: string | null;
          last_contact_date: string | null;
          status: "active" | "inactive";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name?: string;
          last_name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          price_type?: "minorista" | "mayorista" | "otra";
          notes?: string | null;
          last_contact_date?: string | null;
          status?: "active" | "inactive";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          price_type?: "minorista" | "mayorista" | "otra";
          notes?: string | null;
          last_contact_date?: string | null;
          status?: "active" | "inactive";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          presentation: number;
          active: boolean;
          show_in_portal: boolean;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          presentation?: number;
          active?: boolean;
          show_in_portal?: boolean;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          presentation?: number;
          active?: boolean;
          show_in_portal?: boolean;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          storage_path: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          storage_path?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          storage_path?: string | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          name: string;
          unit: string;
          critical_stock: number | null;
          manual_unit_cost: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          unit: string;
          critical_stock?: number | null;
          manual_unit_cost?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          unit?: string;
          critical_stock?: number | null;
          manual_unit_cost?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          product_id: string;
          material_id: string;
          quantity: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          material_id: string;
          quantity: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          material_id?: string;
          quantity?: number;
        };
        Relationships: [];
      };
      price_margins: {
        Row: {
          id: string;
          price_type: "minorista" | "mayorista" | "otra";
          margin_percentage: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          price_type: "minorista" | "mayorista" | "otra";
          margin_percentage: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          price_type?: "minorista" | "mayorista" | "otra";
          margin_percentage?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      product_costs: {
        Row: {
          id: string;
          product_id: string;
          direct_cost: number | null;
          labor_cost: number | null;
          margin_percentage: number | null;
          price_minorista: number | null;
          discount_percentage: number | null;
          price_mayorista: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          direct_cost?: number | null;
          labor_cost?: number | null;
          margin_percentage?: number | null;
          price_minorista?: number | null;
          discount_percentage?: number | null;
          price_mayorista?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          direct_cost?: number | null;
          labor_cost?: number | null;
          margin_percentage?: number | null;
          price_minorista?: number | null;
          discount_percentage?: number | null;
          price_mayorista?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      price_list_history: {
        Row: {
          id: string;
          generated_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          generated_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          generated_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      price_list_history_items: {
        Row: {
          id: string;
          history_id: string;
          product_id: string;
          product_name: string;
          direct_cost: number;
          labor_cost: number;
          total_cost: number;
          margin_percentage: number;
          price_minorista: number;
          discount_percentage: number;
          price_mayorista: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          history_id: string;
          product_id: string;
          product_name: string;
          direct_cost: number;
          labor_cost: number;
          total_cost: number;
          margin_percentage: number;
          price_minorista: number;
          discount_percentage: number;
          price_mayorista: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          history_id?: string;
          product_id?: string;
          product_name?: string;
          direct_cost?: number;
          labor_cost?: number;
          total_cost?: number;
          margin_percentage?: number;
          price_minorista?: number;
          discount_percentage?: number;
          price_mayorista?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          date: string;
          delivery_date: string | null;
          supplier: string | null;
          brand: string | null;
          material_id: string;
          quantity: number;
          total_cost: number;
          unit_cost: number | null;
          shipping_cost_share: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          delivery_date?: string | null;
          supplier?: string | null;
          brand?: string | null;
          material_id: string;
          quantity: number;
          total_cost: number;
          unit_cost?: number | null;
          shipping_cost_share?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          delivery_date?: string | null;
          supplier?: string | null;
          brand?: string | null;
          material_id?: string;
          quantity?: number;
          total_cost?: number;
          unit_cost?: number | null;
          shipping_cost_share?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      indirect_expenses: {
        Row: {
          id: string;
          date: string;
          category_id: string;
          description: string | null;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          category_id: string;
          description?: string | null;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          category_id?: string;
          description?: string | null;
          amount?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      production_logs: {
        Row: {
          id: string;
          date: string;
          product_id: string;
          quantity: number;
          batch_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          product_id: string;
          quantity: number;
          batch_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          product_id?: string;
          quantity?: number;
          batch_code?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: number;
          order_date: string;
          client_id: string | null;
          guest_name: string | null;
          guest_phone: string | null;
          guest_email: string | null;
          guest_city: string | null;
          desired_date: string | null;
          payment_method: "efectivo" | "transferencia" | "sin_cargo" | "canje" | null;
          delivery_method: "retiro" | "cadeteria" | "envio_gratis" | null;
          status: "pendiente" | "confirmado" | "cumplido" | "anulado";
          delivered_date: string | null;
          origin: "manual" | "portal" | "venta_rapida";
          notes: string | null;
          anulation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_date?: string;
          client_id?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          guest_email?: string | null;
          guest_city?: string | null;
          desired_date?: string | null;
          payment_method?: "efectivo" | "transferencia" | "sin_cargo" | "canje" | null;
          delivery_method?: "retiro" | "cadeteria" | "envio_gratis" | null;
          status?: "pendiente" | "confirmado" | "cumplido" | "anulado";
          delivered_date?: string | null;
          origin?: "manual" | "portal" | "venta_rapida";
          notes?: string | null;
          anulation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_date?: string;
          client_id?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          guest_email?: string | null;
          guest_city?: string | null;
          desired_date?: string | null;
          payment_method?: "efectivo" | "transferencia" | "sin_cargo" | "canje" | null;
          delivery_method?: "retiro" | "cadeteria" | "envio_gratis" | null;
          status?: "pendiente" | "confirmado" | "cumplido" | "anulado";
          delivered_date?: string | null;
          origin?: "manual" | "portal" | "venta_rapida";
          notes?: string | null;
          anulation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          unit_cost: number | null;
          subtotal: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          unit_cost?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          unit_cost?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          date: string;
          amount: number;
          method: "efectivo" | "transferencia" | "canje";
          discount_type: "fixed" | "percentage" | null;
          discount_value: number | null;
          discount_amount: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          date: string;
          amount: number;
          method: "efectivo" | "transferencia" | "canje";
          discount_type?: "fixed" | "percentage" | null;
          discount_value?: number | null;
          discount_amount?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          date?: string;
          amount?: number;
          method?: "efectivo" | "transferencia" | "canje";
          discount_type?: "fixed" | "percentage" | null;
          discount_value?: number | null;
          discount_amount?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      inventory_counts: {
        Row: {
          id: string;
          count_date: string;
          type: "materials" | "products";
          finalized_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          count_date: string;
          type: "materials" | "products";
          finalized_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          count_date?: string;
          type?: "materials" | "products";
          finalized_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      inventory_count_items: {
        Row: {
          id: string;
          count_id: string;
          material_id: string | null;
          product_id: string | null;
          theoretical_stock: number;
          physical_stock: number;
          difference: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          count_id: string;
          material_id?: string | null;
          product_id?: string | null;
          theoretical_stock: number;
          physical_stock: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          count_id?: string;
          material_id?: string | null;
          product_id?: string | null;
          theoretical_stock?: number;
          physical_stock?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      stock_adjustments: {
        Row: {
          id: string;
          count_item_id: string | null;
          material_id: string | null;
          product_id: string | null;
          adjustment: number;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          count_item_id?: string | null;
          material_id?: string | null;
          product_id?: string | null;
          adjustment: number;
          reason?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          count_item_id?: string | null;
          material_id?: string | null;
          product_id?: string | null;
          adjustment?: number;
          reason?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          type: string;
          message: string;
          read: boolean;
          order_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          message: string;
          read?: boolean;
          order_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          message?: string;
          read?: boolean;
          order_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      promo_settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      promos: {
        Row: {
          id: string;
          title: string;
          subtitle: string | null;
          promo_text: string | null;
          template_style: string;
          items: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subtitle?: string | null;
          promo_text?: string | null;
          template_style?: string;
          items?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subtitle?: string | null;
          promo_text?: string | null;
          template_style?: string;
          items?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          quote_number: number;
          date: string;
          status: "borrador" | "enviado" | "aceptado" | "rechazado";
          client_name: string;
          client_first_name: string | null;
          client_last_name: string | null;
          client_id: string | null;
          client_phone: string | null;
          client_email: string | null;
          event_date: string | null;
          event_type: string | null;
          estimated_guests: number | null;
          margin_percentage: number;
          labor_cost: number;
          extra_charge_amount: number;
          extra_charge_description: string | null;
          final_price: number;
          validity_days: number;
          payment_terms: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_number: number;
          date?: string;
          status?: "borrador" | "enviado" | "aceptado" | "rechazado";
          client_name: string;
          client_first_name?: string | null;
          client_last_name?: string | null;
          client_id?: string | null;
          client_phone?: string | null;
          client_email?: string | null;
          event_date?: string | null;
          event_type?: string | null;
          estimated_guests?: number | null;
          margin_percentage?: number;
          labor_cost?: number;
          extra_charge_amount?: number;
          extra_charge_description?: string | null;
          final_price?: number;
          validity_days?: number;
          payment_terms?: string | null;
          notes?: string | null;
        };
        Update: {
          status?: "borrador" | "enviado" | "aceptado" | "rechazado";
          client_name?: string;
          client_first_name?: string | null;
          client_last_name?: string | null;
          client_id?: string | null;
          client_phone?: string | null;
          client_email?: string | null;
          event_date?: string | null;
          event_type?: string | null;
          estimated_guests?: number | null;
          margin_percentage?: number;
          labor_cost?: number;
          extra_charge_amount?: number;
          extra_charge_description?: string | null;
          final_price?: number;
          validity_days?: number;
          payment_terms?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_cost: number;
          unit_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_cost?: number;
          unit_price?: number;
        };
        Update: {
          quantity?: number;
          unit_cost?: number;
          unit_price?: number;
        };
        Relationships: [];
      };
      event_results: {
        Row: {
          id: string;
          date: string;
          description: string;
          income: number;
          expenses: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          description: string;
          income?: number;
          expenses?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          description?: string;
          income?: number;
          expenses?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          id: string;
          date: string;
          rate: number;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          rate: number;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          rate?: number;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      order_item_cmv_breakdown: {
        Args: { p_product_id: string; p_date: string };
        Returns: {
          material_id: string;
          material_name: string;
          material_unit: string;
          recipe_qty: number;
          unit_cost: number;
          source_purchase_date: string | null;
          source_supplier: string | null;
          contribution: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
};
