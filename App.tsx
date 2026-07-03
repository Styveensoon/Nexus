import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { StatusBar } from 'expo-status-bar'
import { View, Text } from 'react-native'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import LandingScreen from './src/screens/LandingScreen'
import LoginScreen from './src/screens/LoginScreen'
import RegisterScreen from './src/screens/RegisterScreen'
import WorkspaceSetupScreen from './src/screens/WorkspaceSetupScreen'
import JoinWorkspaceScreen from './src/screens/JoinWorkspaceScreen'
import ProfileSetupScreen from './src/screens/ProfileSetupScreen'
import SemilleroScreen from './src/screens/SemilleroScreen'
import BadgesScreen from './src/screens/BadgesScreen'
import ActivityScreen from './src/screens/ActivityScreen'
import BottomTabs from './src/navigation/BottomTabs'

const Stack = createStackNavigator()

// Decide la pantalla inicial según si ya hay sesión guardada (localStorage/
// AsyncStorage) ANTES de montar el Navigator — así un refresh de página en
// web no manda de vuelta a Landing a alguien que ya había iniciado sesión.
// Mientras se restaura la sesión se muestra un splash en vez de flashear
// Landing y luego saltar a Main.
function RootNavigator() {
  const { loading, session } = useAuth()
  const { isDark } = useTheme()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#020617' : '#FAFAFA' }}>
        <Text style={{ color: isDark ? '#94A3B8' : '#475569' }}>Cargando…</Text>
      </View>
    )
  }

  return (
    <Stack.Navigator
      initialRouteName={session ? 'Main' : 'Landing'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="WorkspaceSetup" component={WorkspaceSetupScreen} />
      <Stack.Screen name="JoinWorkspace" component={JoinWorkspaceScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Main" component={BottomTabs} />
      <Stack.Screen name="Semillero" component={SemilleroScreen} />
      <Stack.Screen name="Badges" component={BadgesScreen} />
      <Stack.Screen name="Activity" component={ActivityScreen} />
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  )
}