import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getUserOrganization, Organization } from "../lib/organizations";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  organization: null,
  loading: true,
  refreshOrganization: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: any) => {
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrganization = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setOrganization(null);
      return;
    }
    const { data } = await getUserOrganization(userId);
    setOrganization(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadOrganization(data.session?.user?.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      await loadOrganization(newSession?.user?.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadOrganization]);

  const refreshOrganization = useCallback(async () => {
    await loadOrganization(session?.user?.id);
  }, [loadOrganization, session?.user?.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setOrganization(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        organization,
        loading,
        refreshOrganization,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
