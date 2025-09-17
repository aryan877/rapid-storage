import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from 'tailwindcss/colors';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

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

function TabNavigator() {
  const { colorScheme } = useTheme();
  const insets = useSafeAreaInsets();

  const themeColors = {
    textActive: colorScheme === 'dark' ? colors.gray[100] : colors.gray[900],
    textInactive: colorScheme === 'dark' ? colors.gray[500] : colors.gray[400],
    activeIndicator: colorScheme === 'dark' ? colors.gray[100] : colors.gray[900],
    tabBar: colorScheme === 'dark' ? colors.gray[900] : colors.white,
    border: colorScheme === 'dark' ? colors.gray[800] : colors.gray[200],
  };

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
                  style={{ backgroundColor: themeColors.activeIndicator }}
                />
              )}
            </View>
          );
        },
        tabBarActiveTintColor: themeColors.textActive,
        tabBarInactiveTintColor: themeColors.textInactive,
        tabBarStyle: {
          backgroundColor: themeColors.tabBar,
          borderTopColor: themeColors.border,
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
  const { colorScheme } = useTheme();

  const themeColors = {
    primary: colorScheme === 'dark' ? colors.blue[500] : colors.blue[600],
    surface: colorScheme === 'dark' ? colors.gray[900] : colors.white,
    border: colorScheme === 'dark' ? colors.gray[800] : colors.gray[200],
    text: colorScheme === 'dark' ? colors.gray[50] : colors.gray[900],
    background: colorScheme === 'dark' ? colors.black : colors.gray[50],
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-black">
        <View className="items-center">
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-400">
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.border,
        },
        headerTintColor: themeColors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        cardStyle: {
          backgroundColor: themeColors.background,
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
                backgroundColor: themeColors.surface,
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
