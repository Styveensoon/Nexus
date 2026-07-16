import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env y completa tus credenciales de Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Limpia la metadata de onboarding pendiente (pending_account_type/pending_org_name/
// pending_invite_code/pending_client_code/pending_data_consent) guardada por
// RegisterScreen al registrarse. Sin esto, esos campos quedan pegados para
// siempre en auth.users, y RootNavigator (App.tsx)/LoginScreen siguen
// redirigiendo a la misma pantalla de onboarding (con el mismo código, aunque
// esté mal o ya no sirva) en cada sesión nueva, sin forma de salir de ese
// flujo — ver docs/TRAMPAS.md. Llamar apenas se resuelve (join/create/client
// exitoso) o cuando el usuario decide pivotar a otro flujo.
export async function clearPendingOnboarding() {
  await supabase.auth.updateUser({
    data: {
      pending_account_type: null,
      pending_org_name: null,
      pending_invite_code: null,
      pending_client_code: null,
      pending_data_consent: null,
    },
  });
}
