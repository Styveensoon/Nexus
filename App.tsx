import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { StatusBar } from 'expo-status-bar'
import { View, Text } from 'react-native'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { SpaceProvider, useSpace } from './src/context/SpaceContext'
import LandingScreen from './src/screens/LandingScreen'
import LoginScreen from './src/screens/LoginScreen'
import RegisterScreen from './src/screens/RegisterScreen'
import WorkspaceSetupScreen from './src/screens/WorkspaceSetupScreen'
import JoinWorkspaceScreen from './src/screens/JoinWorkspaceScreen'
import ClientJoinScreen from './src/screens/ClientJoinScreen'
import AddSpaceScreen from './src/screens/AddSpaceScreen'
import ProfileSetupScreen from './src/screens/ProfileSetupScreen'
import SemilleroScreen from './src/screens/SemilleroScreen'
import BadgesScreen from './src/screens/BadgesScreen'
import ActivityScreen from './src/screens/ActivityScreen'
import OrganizationSettingsScreen from './src/screens/OrganizationSettingsScreen'
import ClientsScreen from './src/screens/ClientsScreen'
import ClientDetailScreen from './src/screens/ClientDetailScreen'
import ProjectDetailScreen from './src/screens/ProjectDetailScreen'
import TeamDetailScreen from './src/screens/TeamDetailScreen'
import BottomTabs from './src/navigation/BottomTabs'
import ClientTabs from './src/navigation/ClientTabs'

const Stack = createStackNavigator()

// Decide la pantalla inicial según si ya hay sesión guardada (localStorage/
// AsyncStorage) ANTES de montar el Navigator — así un refresh de página en
// web no manda de vuelta a Landing a alguien que ya había iniciado sesión.
// Mientras se restaura la sesión (y, si hay sesión, mientras se resuelve el
// espacio activo — ver SpaceContext, docs/CLIENTE.md §2) se muestra un splash
// en vez de flashear Landing y luego saltar a Main.
function RootNavigator() {
  const { loading, session } = useAuth()
  const { spaces, activeSpace, loading: spaceLoading } = useSpace()
  const { isDark } = useTheme()

  if (loading || (session && spaceLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#020617' : '#FAFAFA' }}>
        <Text style={{ color: isDark ? '#94A3B8' : '#475569' }}>Cargando…</Text>
      </View>
    )
  }

  // "Main" renderiza un shell distinto según el TIPO de espacio activo — el
  // shell de organización (BottomTabs) para member/owner, o el shell de
  // cliente (ClientTabs) para un espacio "client". Registrar distintos
  // componentes bajo el mismo nombre de ruta según una condición ya es un
  // patrón soportado por React Navigation (ver su guía de "Authentication
  // flows"); acá el nombre de ruta se mantiene fijo para que cualquier
  // navigation.replace("Main")/navigate("Main") existente siga funcionando
  // sin importar desde qué pantalla se llame.
  const MainComponent = activeSpace?.kind === 'client' ? ClientTabs : BottomTabs

  // Retomar onboarding pendiente si el Stack.Navigator monta DIRECTO con una
  // sesión ya existente pero sin ningún espacio todavía (organización creada/
  // unida o cliente unido) — pasa cuando el link de confirmación de correo
  // restaura la sesión sola (Supabase la detecta por URL) sin pasar por
  // LoginScreen.handleLogin, que es el único lugar que antes resolvía esto.
  // A diferencia de ese chequeo (que corre en un mismo montaje del stack, así
  // que puede navigation.replace después), acá se decide ANTES del primer
  // render del Stack.Navigator, así que va como initialRouteName/initialParams
  // en vez de un efecto — session/spaces ya están resueltos en este punto
  // (loading/spaceLoading en false arriba), no hace falta reactividad extra.
  const pendingMeta = (session?.user?.user_metadata ?? {}) as Record<string, any>
  let initialRouteName: string = 'Landing'
  if (session) {
    if (spaces.length > 0) {
      initialRouteName = 'Main'
    } else if (pendingMeta.pending_account_type === 'create') {
      initialRouteName = 'WorkspaceSetup'
    } else if (pendingMeta.pending_account_type === 'join' && pendingMeta.pending_invite_code) {
      initialRouteName = 'JoinWorkspace'
    } else if (pendingMeta.pending_account_type === 'client' && pendingMeta.pending_client_code) {
      initialRouteName = 'ClientJoin'
    } else {
      initialRouteName = 'Main'
    }
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="WorkspaceSetup"
        component={WorkspaceSetupScreen}
        initialParams={{ orgName: pendingMeta.pending_org_name ?? '' }}
      />
      <Stack.Screen
        name="JoinWorkspace"
        component={JoinWorkspaceScreen}
        initialParams={{ code: pendingMeta.pending_invite_code ?? '' }}
      />
      <Stack.Screen
        name="ClientJoin"
        component={ClientJoinScreen}
        initialParams={{ code: pendingMeta.pending_client_code ?? '', dataConsent: !!pendingMeta.pending_data_consent }}
      />
      <Stack.Screen name="AddSpace" component={AddSpaceScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Main" component={MainComponent} />
      <Stack.Screen name="Semillero" component={SemilleroScreen} />
      <Stack.Screen name="Badges" component={BadgesScreen} />
      <Stack.Screen name="Activity" component={ActivityScreen} />
      <Stack.Screen name="OrganizationSettings" component={OrganizationSettingsScreen} />
      <Stack.Screen name="Clients" component={ClientsScreen} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SpaceProvider>
          <NavigationContainer documentTitle={{ enabled: false }}>
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
        </SpaceProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
