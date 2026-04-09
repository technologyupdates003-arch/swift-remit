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
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at: string
          currency: string
          id: string
          is_default: boolean
          is_verified: boolean
          paystack_recipient_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          paystack_recipient_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          paystack_recipient_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commission_config: {
        Row: {
          commission_rate: number
          commission_type: string
          created_at: string | null
          created_by: string | null
          currency: string
          id: string
          is_active: boolean | null
          max_commission: number | null
          min_commission: number | null
          service_type: string
          updated_at: string | null
        }
        Insert: {
          commission_rate: number
          commission_type: string
          created_at?: string | null
          created_by?: string | null
          currency?: string
          id?: string
          is_active?: boolean | null
          max_commission?: number | null
          min_commission?: number | null
          service_type: string
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number
          commission_type?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string
          id?: string
          is_active?: boolean | null
          max_commission?: number | null
          min_commission?: number | null
          service_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          from_currency: string
          id: string
          rate: number
          to_currency: string
          updated_at: string
        }
        Insert: {
          from_currency: string
          id?: string
          rate: number
          to_currency: string
          updated_at?: string
        }
        Update: {
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_config: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string
          fee_amount: number
          fee_name: string
          fee_type: string
          id: string
          is_active: boolean | null
          max_amount: number | null
          min_amount: number | null
          service_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          fee_amount: number
          fee_name: string
          fee_type: string
          id?: string
          is_active?: boolean | null
          max_amount?: number | null
          min_amount?: number | null
          service_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          fee_amount?: number
          fee_name?: string
          fee_type?: string
          id?: string
          is_active?: boolean | null
          max_amount?: number | null
          min_amount?: number | null
          service_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_transactions: {
        Row: {
          commission_amount: number | null
          created_at: string | null
          currency: string
          fee_amount: number
          id: string
          reference_id: string | null
          service_description: string
          service_type: string
          status: string | null
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          commission_amount?: number | null
          created_at?: string | null
          currency: string
          fee_amount: number
          id?: string
          reference_id?: string | null
          service_description: string
          service_type: string
          status?: string | null
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          commission_amount?: number | null
          created_at?: string | null
          currency?: string
          fee_amount?: number
          id?: string
          reference_id?: string | null
          service_description?: string
          service_type?: string
          status?: string | null
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      intasend_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          intasend_response: Json | null
          intasend_transaction_id: string | null
          narrative: string | null
          phone_number: string | null
          recipient_name: string | null
          status: string
          transaction_type: string
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          intasend_response?: Json | null
          intasend_transaction_id?: string | null
          narrative?: string | null
          phone_number?: string | null
          recipient_name?: string | null
          status?: string
          transaction_type: string
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          intasend_response?: Json | null
          intasend_transaction_id?: string | null
          narrative?: string | null
          phone_number?: string | null
          recipient_name?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intasend_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intasend_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          admin_notes: string | null
          created_at: string
          document_type: string
          file_url: string
          id: string
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          document_type: string
          file_url: string
          id?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          document_type?: string
          file_url?: string
          id?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_requests: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          instructions: string | null
          phone_number: string
          request_id: string
          status: string
          updated_at: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          instructions?: string | null
          phone_number: string
          request_id: string
          status?: string
          updated_at?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          instructions?: string | null
          phone_number?: string
          request_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpesa_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_stk_requests: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          intasend_payload: Json | null
          intasend_response: Json | null
          phone_number: string
          reference_code: string
          status: string
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          intasend_payload?: Json | null
          intasend_response?: Json | null
          phone_number: string
          reference_code: string
          status?: string
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          intasend_payload?: Json | null
          intasend_response?: Json | null
          phone_number?: string
          reference_code?: string
          status?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_stk_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read_status: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_status?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_status?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          purpose: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          purpose?: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
          verified?: boolean
        }
        Relationships: []
      }
      paystack_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paystack_reference: string | null
          paystack_response: Json | null
          paystack_transaction_id: string | null
          recipient_code: string | null
          status: string
          transaction_type: string
          transfer_code: string | null
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          paystack_reference?: string | null
          paystack_response?: Json | null
          paystack_transaction_id?: string | null
          recipient_code?: string | null
          status?: string
          transaction_type: string
          transfer_code?: string | null
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paystack_reference?: string | null
          paystack_response?: Json | null
          paystack_transaction_id?: string | null
          recipient_code?: string | null
          status?: string
          transaction_type?: string
          transfer_code?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paystack_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paystack_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          pin_hash: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          pin_hash?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          pin_hash?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_log: {
        Row: {
          cost: number
          created_at: string | null
          currency: string | null
          id: string
          message: string
          phone_number: string
          reference_id: string | null
          sms_type: string
          status: string | null
          talksasa_response: Json | null
          user_id: string
        }
        Insert: {
          cost: number
          created_at?: string | null
          currency?: string | null
          id?: string
          message: string
          phone_number: string
          reference_id?: string | null
          sms_type: string
          status?: string | null
          talksasa_response?: Json | null
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          message?: string
          phone_number?: string
          reference_id?: string | null
          sms_type?: string
          status?: string | null
          talksasa_response?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_downloads: {
        Row: {
          created_at: string | null
          currency: string | null
          date_from: string
          date_to: string
          download_count: number | null
          fee_charged: number
          file_path: string | null
          id: string
          statement_type: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          date_from: string
          date_to: string
          download_count?: number | null
          fee_charged: number
          file_path?: string | null
          id?: string
          statement_type: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          date_from?: string
          date_to?: string
          download_count?: number | null
          fee_charged?: number
          file_path?: string | null
          id?: string
          statement_type?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statement_downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_downloads_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          confirmations: number | null
          created_at: string
          currency: string
          fee: number
          id: string
          network: string | null
          receiver_user_id: string | null
          receiver_wallet_id: string | null
          reference: string
          sender_user_id: string | null
          sender_wallet_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          tx_hash: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          confirmations?: number | null
          created_at?: string
          currency: string
          fee?: number
          id?: string
          network?: string | null
          receiver_user_id?: string | null
          receiver_wallet_id?: string | null
          reference?: string
          sender_user_id?: string | null
          sender_wallet_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tx_hash?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          confirmations?: number | null
          created_at?: string
          currency?: string
          fee?: number
          id?: string
          network?: string | null
          receiver_user_id?: string | null
          receiver_wallet_id?: string | null
          reference?: string
          sender_user_id?: string | null
          sender_wallet_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tx_hash?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_receiver_user_id_fkey"
            columns: ["receiver_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_receiver_wallet_id_fkey"
            columns: ["receiver_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_sender_wallet_id_fkey"
            columns: ["sender_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          failed_pin_attempts: number
          full_name: string | null
          id: string
          is_admin: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          phone: string | null
          pin_hash: string | null
          pin_locked_until: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          failed_pin_attempts?: number
          full_name?: string | null
          id?: string
          is_admin?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          pin_hash?: string | null
          pin_locked_until?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          failed_pin_attempts?: number
          full_name?: string | null
          id?: string
          is_admin?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          pin_hash?: string | null
          pin_locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          status: string
          type: Database["public"]["Enums"]["wallet_type"]
          updated_at: string
          user_id: string
          wallet_address: string | null
          wallet_number: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency: string
          id?: string
          status?: string
          type?: Database["public"]["Enums"]["wallet_type"]
          updated_at?: string
          user_id: string
          wallet_address?: string | null
          wallet_number: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          type?: Database["public"]["Enums"]["wallet_type"]
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
          wallet_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_service_fee: {
        Args: { p_amount: number; p_currency?: string; p_service_type: string }
        Returns: Json
      }
      charge_service_fee:
        | {
            Args: {
              p_amount: number
              p_currency?: string
              p_reference_id?: string
              p_service_description: string
              p_service_type: string
              p_user_id: string
              p_wallet_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
              p_currency?: string
              p_reference_id?: string
              p_service_description: string
              p_service_type: string
              p_user_id: string
              p_wallet_id: string
            }
            Returns: Json
          }
      complete_mpesa_payment: {
        Args: { mpesa_transaction_id?: string; request_id: string }
        Returns: Json
      }
      complete_mpesa_stk_push: {
        Args: { p_mpesa_receipt?: string; p_reference_code: string }
        Returns: Json
      }
      exchange_currency_with_fees: {
        Args: {
          p_exchange_rate: number
          p_from_amount: number
          p_from_wallet_id: string
          p_pin_hash: string
          p_to_wallet_id: string
        }
        Returns: Json
      }
      generate_statement_with_fee: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_statement_type: string
          p_user_id: string
          p_wallet_id: string
        }
        Returns: Json
      }
      get_user_id_from_auth: { Args: never; Returns: string }
      get_user_mpesa_requests: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          currency: string
          id: string
          instructions: string
          phone_number: string
          request_id: string
          status: string
        }[]
      }
      get_user_wallets: {
        Args: never
        Returns: {
          balance: number
          created_at: string
          currency: string
          id: string
          status: string
          type: string
          wallet_number: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      intasend_mpesa_fund_wallet: {
        Args: { p_amount: number; p_phone_number: string; p_wallet_id: string }
        Returns: Json
      }
      intasend_mpesa_withdraw: {
        Args: {
          p_amount: number
          p_phone_number: string
          p_recipient_name: string
          p_wallet_id: string
        }
        Returns: Json
      }
      intasend_wallet_transfer: {
        Args: {
          p_amount: number
          p_from_wallet_id: string
          p_narrative?: string
          p_to_wallet_number: string
        }
        Returns: Json
      }
      mpesa_fund_wallet: {
        Args: { amount: number; phone_number: string; wallet_id: string }
        Returns: Json
      }
      mpesa_fund_wallet_sql_only: {
        Args: { amount: number; phone_number: string; wallet_id: string }
        Returns: Json
      }
      mpesa_stk_push_sql_only: {
        Args: { p_amount: number; p_phone_number: string; p_wallet_id: string }
        Returns: Json
      }
      paystack_complete_bank_withdrawal: {
        Args: {
          p_paystack_response: Json
          p_reference: string
          p_transfer_code: string
        }
        Returns: Json
      }
      paystack_complete_card_funding: {
        Args: { p_paystack_response: Json; p_reference: string }
        Returns: Json
      }
      paystack_handle_failed_transaction: {
        Args: { p_error_message: string; p_reference: string }
        Returns: Json
      }
      paystack_initiate_bank_withdrawal: {
        Args: {
          p_amount: number
          p_recipient_code: string
          p_reference: string
          p_wallet_id: string
        }
        Returns: Json
      }
      paystack_initiate_card_funding: {
        Args: { p_amount: number; p_reference: string; p_wallet_id: string }
        Returns: Json
      }
      send_sms_with_fee: {
        Args: {
          p_message: string
          p_phone_number: string
          p_reference_id?: string
          p_sms_type: string
          p_user_id: string
        }
        Returns: Json
      }
      transfer_with_fees_and_sms: {
        Args: {
          p_amount: number
          p_description?: string
          p_from_wallet_id: string
          p_pin_hash: string
          p_to_wallet_id: string
        }
        Returns: Json
      }
      update_intasend_transaction_status: {
        Args: {
          p_intasend_response?: Json
          p_status: string
          p_transaction_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      kyc_status: "pending" | "approved" | "rejected" | "not_submitted"
      transaction_status: "pending" | "completed" | "failed" | "cancelled"
      transaction_type: "deposit" | "withdrawal" | "transfer" | "exchange"
      wallet_type: "fiat" | "crypto"
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
      app_role: ["admin", "moderator", "user"],
      kyc_status: ["pending", "approved", "rejected", "not_submitted"],
      transaction_status: ["pending", "completed", "failed", "cancelled"],
      transaction_type: ["deposit", "withdrawal", "transfer", "exchange"],
      wallet_type: ["fiat", "crypto"],
    },
  },
} as const
