import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthContext } from "./AuthContext";
import { listMySpaces, Space, spaceKey } from "../lib/spaces";

type SpaceContextType = {
  spaces: Space[];
  activeSpace: Space | null;
  setActiveSpace: (space: Space) => void;
  refreshSpaces: () => Promise<void>;
  loading: boolean;
};

export const SpaceContext = createContext<SpaceContextType>({
  spaces: [],
  activeSpace: null,
  setActiveSpace: () => {},
  refreshSpaces: async () => {},
  loading: true,
});

const storageKey = (userId: string) => `nexus_active_space:${userId}`;

// Multi-espacio (docs/CLIENTE.md §2): un usuario puede tener varios espacios
// (organización propia, cliente de otra, etc.) con la misma cuenta. Este
// contexto resuelve la lista completa y cuál está activo — "activo" es una
// preferencia de DISPOSITIVO (AsyncStorage, ya usado por src/lib/supabase.ts
// para la sesión), no algo que viva en el servidor.
export const SpaceProvider = ({ children }: any) => {
  // useContext DIRECTO sobre AuthContext (no el hook useAuth() combinado) a
  // propósito: useAuth() en AuthContext.tsx lee este mismo SpaceContext para
  // derivar `organization`, así que SpaceProvider necesita la sesión "cruda"
  // para no crear un ciclo de lectura en tiempo de render.
  const { user } = useContext(AuthContext);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpaceState] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSpaces = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setSpaces([]);
      setActiveSpaceState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await listMySpaces(userId);
    setSpaces(data);

    let restoredKey: string | null = null;
    try {
      restoredKey = await AsyncStorage.getItem(storageKey(userId));
    } catch {
      // AsyncStorage no disponible (raro) — sigue sin restaurar preferencia
    }

    const restored = restoredKey ? data.find((s) => spaceKey(s) === restoredKey) ?? null : null;
    setActiveSpaceState(restored ?? data[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSpaces(user?.id);
  }, [user?.id, loadSpaces]);

  const setActiveSpace = useCallback(
    (space: Space) => {
      setActiveSpaceState(space);
      if (user?.id) {
        AsyncStorage.setItem(storageKey(user.id), spaceKey(space)).catch(() => {});
      }
    },
    [user?.id]
  );

  const refreshSpaces = useCallback(async () => {
    await loadSpaces(user?.id);
  }, [loadSpaces, user?.id]);

  return (
    <SpaceContext.Provider value={{ spaces, activeSpace, setActiveSpace, refreshSpaces, loading }}>
      {children}
    </SpaceContext.Provider>
  );
};

export const useSpace = () => useContext(SpaceContext);
