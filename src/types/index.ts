// =============================================
// Shared Type Definitions for SimpleLabOS
// =============================================
// These types are derived from the Supabase schema and used across the application.

// Core Tenant & User Types
export interface Lab {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  subscription_tier: 'trial' | 'basic' | 'standard' | 'pro';
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  lab_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'technician' | 'dentist';
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Business Data Types
export interface Doctor {
  id: string;
  lab_id: string;
  name: string;
  clinic_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  default_material: string | null;
  default_shade: string | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type CasePriority = 'normal' | 'urgent' | 'rush';
export type CaseStatus = 'inbox' | 'production' | 'qc' | 'ready' | 'shipped' | 'on_hold';

export interface Case {
  id: string;
  lab_id: string;
  case_number: string;
  doctor_id: string;
  patient_name_encrypted: string | null;
  tooth_positions: number[];
  material_type: string | null;
  shade: string | null;
  lot_number: string | null;
  priority: CasePriority;
  status: CaseStatus;
  received_at: string;
  due_date: string | null;
  shipped_at: string | null;
  tracking_number: string | null;
  price: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  doctors?: { name: string } | null;
}

export interface CaseFile {
  id: string;
  case_id: string;
  file_type: 'photo' | 'stl' | 'other';
  file_url: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string | null;
  upload_source: 'qr' | 'manual' | 'email' | null;
  created_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  lab_id: string;
  invoice_number: string;
  doctor_id: string;
  case_ids: string[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  doctors?: { name: string; clinic_name: string | null } | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export type EmailImportStatus = 'pending' | 'processed' | 'failed' | 'manual_review';

export interface EmailImport {
  id: string;
  lab_id: string;
  sender_email: string;
  subject: string | null;
  body_text: string | null;
  parsed_data: Record<string, unknown>;
  status: EmailImportStatus;
  case_id: string | null;
  raw_email: string | null;
  confidence_score: number | null;
  received_at: string;
  processed_at: string | null;
  // Joined fields
  cases?: { case_number: string } | null;
}

export interface Notification {
  id: string;
  lab_id: string;
  title: string;
  message: string;
  type: 'case_update' | 'invoice_paid' | 'system' | 'message';
  related_case_id?: string;
  related_invoice_id?: string;
  read_at?: string;
  created_at: string;
}

export interface Message {
  id: string;
  case_id: string;
  sender_type: 'lab' | 'doctor';
  content: string;
  read_at?: string;
  created_at: string;
  // Joined fields
  cases?: {
    case_number: string;
    doctors?: { name: string } | null;
  };
}
