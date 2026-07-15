export type DashboardPeriod = '7d' | '30d' | 'all';

export interface Job {
  id: string;
  type: string;
  model_id: string;
  status: string;
  result_url: string | null;
  cost: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: string;
  job_id: string | null;
  description: string | null;
  created_at: string;
}

export interface DashboardStats {
  balance: number;
  period: DashboardPeriod;
  kpis: {
    balance: number;
    images_success: number;
    videos_success: number;
    credits_consumed_net: number;
  };
  totals: {
    jobs_total: number;
    jobs_success: number;
    jobs_failed: number;
    success_rate: number;
  };
  credits: {
    charged: number;
    refunded: number;
    consumed_net: number;
    signup_bonus: number;
    topup?: number;
    promotion?: number;
    topped_up_total?: number;
  };
  charts: {
    jobs_by_day: Array<{ date: string; jobs: number; success: number; failed: number }>;
    credits_by_day: Array<{ date: string; charged: number; refunded: number; net: number }>;
  };
  chart_bucket_days?: number;
  chart_column_count?: number;
  recent_jobs: Job[];
  recent_transactions: CreditTransaction[];
}
