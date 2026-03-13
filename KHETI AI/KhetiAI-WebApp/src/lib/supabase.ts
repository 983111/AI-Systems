const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SESSION_STORAGE_KEY = "khetiai.supabase.session";

type SupabaseError = {
  message: string;
};

export type User = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type Session = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: User;
};

type AuthChangeEvent = "SIGNED_IN" | "SIGNED_OUT" | "INITIAL_SESSION";
type AuthStateCallback = (event: AuthChangeEvent, session: Session | null) => void;

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  state: string | null;
  district: string | null;
  land_size_acres: number | null;
  primary_crop: string | null;
  preferred_language: string;
  subscription_tier: "free" | "premium";
  created_at: string;
  updated_at: string;
};

class QueryBuilder {
  private filters: Array<{ column: string; value: string }> = [];

  constructor(
    private readonly table: string,
    private readonly getAccessToken: () => string | null,
  ) {}

  select(_columns: string) {
    return this;
  }

  eq(column: string, value: string) {
    this.filters.push({ column, value });
    return this;
  }

  async single() {
    if (!supabaseUrl || !supabaseAnonKey) {
      return { data: null, error: { message: "Missing Supabase environment variables." } as SupabaseError };
    }

    const params = new URLSearchParams({ select: "*" });
    this.filters.forEach(({ column, value }) => {
      params.set(column, `eq.${value}`);
    });

    const response = await fetch(`${supabaseUrl}/rest/v1/${this.table}?${params.toString()}`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${this.getAccessToken() ?? supabaseAnonKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return { data: null, error: { message: text || "Failed to fetch data." } as SupabaseError };
    }

    const rows = (await response.json()) as unknown[];
    return { data: (rows[0] as Record<string, unknown> | undefined) ?? null, error: null };
  }
}

class LightweightSupabaseClient {
  private subscribers = new Set<AuthStateCallback>();

  private readSession(): Session | null {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Session;
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }

  private writeSession(session: Session | null) {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private notify(event: AuthChangeEvent, session: Session | null) {
    this.subscribers.forEach((callback) => callback(event, session));
  }

  private async authRequest<T>(path: string, body: Record<string, unknown>) {
    if (!supabaseUrl || !supabaseAnonKey) {
      return { data: null as T | null, error: { message: "Missing Supabase environment variables." } as SupabaseError };
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        data: null as T | null,
        error: { message: payload?.msg ?? payload?.error_description ?? payload?.message ?? "Authentication failed." } as SupabaseError,
      };
    }

    return { data: payload as T, error: null };
  }

  auth = {
    getSession: async () => {
      const session = this.readSession();
      return { data: { session }, error: null };
    },

    onAuthStateChange: (callback: AuthStateCallback) => {
      this.subscribers.add(callback);
      callback("INITIAL_SESSION", this.readSession());

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.subscribers.delete(callback);
            },
          },
        },
      };
    },

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await this.authRequest<Session>("token?grant_type=password", { email, password });
      if (error || !data) return { data: null, error };

      this.writeSession(data);
      this.notify("SIGNED_IN", data);
      return { data: { session: data, user: data.user }, error: null };
    },

    signUp: async ({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }) => {
      const { data, error } = await this.authRequest<Session>("signup", {
        email,
        password,
        data: options?.data,
      });

      if (error) return { data: null, error };
      if (data?.access_token) {
        this.writeSession(data);
        this.notify("SIGNED_IN", data);
      }

      return { data: { session: data, user: data?.user ?? null }, error: null };
    },

    resetPasswordForEmail: async (email: string, options?: { redirectTo?: string }) => {
      const { error } = await this.authRequest<Record<string, never>>("recover", {
        email,
        redirect_to: options?.redirectTo,
      });

      return { data: {}, error };
    },

    signOut: async () => {
      this.writeSession(null);
      this.notify("SIGNED_OUT", null);
      return { error: null };
    },
  };

  from(table: string) {
    return new QueryBuilder(table, () => this.readSession()?.access_token ?? null);
  }
}

export const supabase = new LightweightSupabaseClient();
