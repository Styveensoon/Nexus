import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider } from './src/context/ThemeContext'
import { AuthProvider } from './src/context/AuthContext'
import LandingScreen from './src/screens/LandingScreen'
import LoginScreen from './src/screens/LoginScreen'
import RegisterScreen from './src/screens/RegisterScreen'
import WorkspaceSetupScreen from './src/screens/WorkspaceSetupScreen'
import JoinWorkspaceScreen from './src/screens/JoinWorkspaceScreen'
import SemilleroScreen from './src/screens/SemilleroScreen'
import BottomTabs from './src/navigation/BottomTabs'

const Stack = createStackNavigator()

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator
            initialRouteName="Landing"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="WorkspaceSetup" component={WorkspaceSetupScreen} />
            <Stack.Screen name="JoinWorkspace" component={JoinWorkspaceScreen} />
            <Stack.Screen name="Main" component={BottomTabs} />
            <Stack.Screen name="Semillero" component={SemilleroScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  )
}