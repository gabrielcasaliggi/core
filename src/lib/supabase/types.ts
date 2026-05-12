/**
 * Tipos TypeScript que reflejan el schema de Supabase.
 * Generados manualmente — en producción usar `supabase gen types typescript`.
 */

export interface RouterRow {
  id: string;
  site_id: string;
  display_name: string;
  short_name: string;
  site_type: "headquarters" | "branch" | "remote" | "studio";
  lat: number;
  lng: number;
  host: string;
  port: number;
  protocol: "http" | "https";
  username: string;
  password: string;          // Plaintext por ahora. Fase 2: Supabase Vault
  provider: string | null;
  bandwidth_mbps: number;
  wan_type: "fiber" | "radiolink" | "starlink" | "vpn";
  tls_reject_unauthorized: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProvisioningJobRow {
  id: string;
  router_id: string | null;
  site_name: string;
  template_id: string;
  hardware: string;
  status: "pending" | "running" | "success" | "error";
  started_at: string;
  completed_at: string | null;
  steps: ProvisioningStepRow[];
  error_message: string | null;
  /** Metadatos extra: coordenadas, tipo de sitio, etc. */
  metadata: Record<string, unknown> | null;
}

export interface ProvisioningStepRow {
  label: string;
  command: string;
  status: "pending" | "running" | "success" | "error";
  log?: string;
}

export interface AlertRow {
  id: string;
  site_id: string;
  severity: "info" | "warning" | "critical";
  message: string;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

type RouterInsert = Omit<RouterRow, "id" | "created_at" | "updated_at"> & Partial<Pick<RouterRow, "id" | "created_at" | "updated_at">>;
type JobInsert    = Omit<ProvisioningJobRow, "id" | "started_at"> & Partial<Pick<ProvisioningJobRow, "id" | "started_at">>;
type AlertInsert  = Omit<AlertRow, "id" | "created_at"> & Partial<Pick<AlertRow, "id" | "created_at">>;

export interface Database {
  public: {
    Tables: {
      routers: {
        Row:    RouterRow;
        Insert: RouterInsert;
        Update: Partial<Omit<RouterRow, "id">>;
        Relationships: [];
      };
      provisioning_jobs: {
        Row:    ProvisioningJobRow;
        Insert: JobInsert;
        Update: Partial<Omit<ProvisioningJobRow, "id">>;
        Relationships: [];
      };
      alerts: {
        Row:    AlertRow;
        Insert: AlertInsert;
        Update: Partial<Omit<AlertRow, "id">>;
        Relationships: [];
      };
    };
    Views:          Record<string, never>;
    Functions:      Record<string, never>;
    Enums:          Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
