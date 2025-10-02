import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './global.css';
import { queryClient } from './lib/queryClient';
import AppNavigator from './navigation/AppNavigator';
import AuthScreen from './screens/AuthScreen';

// Main App Component that handles auth state
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#a1a1aa',
    background: '#09090b',
    card: '#111113',
    text: '#d4d4d8',
    border: '#27272a',
    notification: '#a1a1aa',
  },
};

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-950">
        {/* You can add a loading spinner here if needed */}
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {user ? <AppNavigator /> : <AuthScreen />}
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

// Root App Component
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ShareIntentProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </ShareIntentProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
