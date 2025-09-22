import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

// Import screens
import AuthScreen from '../screens/AuthScreen';
import FileManagerScreen from '../screens/FileManagerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UploadScreen from '../screens/UploadScreen';

type RootStackParamList = {
  Main: undefined;
  Auth: undefined;
  Upload: { folderId?: string };
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<RootStackParamList>();

const tabPalette = {
  textActive: '#e4e4e7',
  textInactive: '#71717a',
  activeIndicator: '#e4e4e7',
  tabBar: '#111113',
  border: '#27272a',
};

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Files') {
            iconName = focused ? 'folder' : 'folder-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return (
            <View className="items-center justify-center">
              <Ionicons name={iconName} size={24} color={color} />
              {focused && (
                <View
                  className="absolute -top-4 h-1 w-12 rounded-full"
                  style={{ backgroundColor: tabPalette.activeIndicator }}
                />
              )}
            </View>
          );
        },
        tabBarActiveTintColor: tabPalette.textActive,
        tabBarInactiveTintColor: tabPalette.textInactive,
        tabBarStyle: {
          backgroundColor: tabPalette.tabBar,
          borderTopColor: tabPalette.border,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 70 + Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 12,
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingTop: 4,
          paddingBottom: 4,
        },
      })}>
      <Tab.Screen name="Files" component={FileManagerScreen} options={{ title: 'My Drive' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();
  const stackPalette = {
    primary: '#a1a1aa',
    surface: '#111113',
    border: '#27272a',
    text: '#e4e4e7',
    background: '#09090b',
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-950">
        <View className="items-center">
          <ActivityIndicator size="large" color={stackPalette.primary} />
          <Text className="mt-4 text-lg font-medium text-zinc-500">Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: stackPalette.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: stackPalette.border,
        },
        headerTintColor: stackPalette.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        cardStyle: {
          backgroundColor: stackPalette.background,
        },
      }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
          <Stack.Screen
            name="Upload"
            component={UploadScreen}
            options={{
              title: 'Upload Files',
              presentation: 'modal',
              headerStyle: {
                backgroundColor: stackPalette.surface,
              },
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default AppNavigator;
