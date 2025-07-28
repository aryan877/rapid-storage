import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import './global.css';
import { queryClient } from './lib/queryClient';
import AppNavigator from './navigation/AppNavigator';
import AuthScreen from './screens/AuthScreen';

// Main App Component that handles auth state
function AppContent() {
  const { user, loading } = useAuth();
  const { colorScheme } = useTheme();

  if (loading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        {/* You can add a loading spinner here if needed */}
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthScreen />}
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

// Root App Component
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
