import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Organization } from "../lib/organizations";
import { SpaceContext } from "./SpaceContext";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

// Contexto crudo: solo sesión. La resolución de "a qué organización
// pertenezco" vive en SpaceContext desde que existe multi-espacio
// (docs/CLIENTE.md §2) — ver useAuth() más abajo, que combina ambos.
export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: any) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// useAuth() combina AuthContext (sesión) + SpaceContext (espacio activo) para
// que las pantallas que ya llaman useAuth().organization/refreshOrganization
// sigan funcionando sin tocarlas una por una tras agregar multi-espacio.
// `organization` ahora es un alias derivado del espacio "member" activo (null
// si el espacio activo es de tipo "client" o si no hay ninguno todavía) —
// dejó de resolverse con su propia query acá, SpaceContext es la fuente de
// verdad. Requiere que SpaceProvider esté montado DENTRO de AuthProvider
// (ver App.tsx); si no lo está, useContext(SpaceContext) devuelve los
// defaults del contexto (activeSpace: null), organization sale null también.
export const useAuth = () => {
  const auth = useContext(AuthContext);
  const space = useContext(SpaceContext);
  const organization: Organization | null = space.activeSpace?.kind === "member" ? space.activeSpace.organization : null;

  return {
    ...auth,
    organization,
    refreshOrganization: space.refreshSpaces,
  };
};
