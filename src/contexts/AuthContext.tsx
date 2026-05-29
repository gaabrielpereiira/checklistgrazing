import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface ProfileData {
  id: string;
  name: string;
  email: string | null;
  workspace_id: string | null;
  avatar_url: string | null;
  phone: string | null;
  whatsapp_notifications: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: ProfileData | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, signOut: async () => {} });

function fetchProfile(userId: string) {
  return supabase
    .from("profiles")
    .select("id, name, email, workspace_id, avatar_url, phone, whatsapp_notifications")
    .eq("user_id", userId)
    .single();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Restore session from storage first
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id).then(({ data }) => {
          setProfile(data);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for changes — NEVER await inside this callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        // Fire and forget — no await
        fetchProfile(currentUser.id).then(({ data }) => setProfile(data));
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
