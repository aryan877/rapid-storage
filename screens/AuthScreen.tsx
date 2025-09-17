import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

const AuthScreen: React.FC = () => {
  const { signInWithGoogle, loading } = useAuth();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#e5e7eb' : '#111827';

  const buttonShadow = {
    shadowColor: colorScheme === 'dark' ? '#00000080' : '#1118270f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: colorScheme === 'dark' ? 0.32 : 0.08,
    shadowRadius: 24,
    elevation: 4,
  };

  const features = [
    {
      icon: 'folder-open-outline' as const,
      title: 'Organized by default',
      description: 'Nest folders and find files without digging.',
    },
    {
      icon: 'cloud-outline' as const,
      title: 'Generous storage',
      description: 'Upload up to 5GB per file with ease.',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Private & secure',
      description: 'End-to-end encryption backed by AWS S3.',
    },
  ];

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f7f8fb] dark:bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="flex-1 justify-between px-6 py-10">
          <View>
            <View className="items-center">
              <View className="mb-7 h-16 w-16 items-center justify-center rounded-full border border-gray-200/70 bg-white/80 dark:border-white/10 dark:bg-white/5">
                <Ionicons name="cloud-outline" size={30} color={iconColor} />
              </View>
              <Text className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
                Rapid Storage
              </Text>
              <Text className="mt-3 max-w-xs text-center text-base leading-relaxed text-gray-500 dark:text-gray-400">
                A calm space to save, organize, and access your files anywhere.
              </Text>
            </View>

            <View className="mt-12 items-center">
              <Text className="text-xs uppercase tracking-[0.35em] text-gray-400 dark:text-gray-500">
                Sign in
              </Text>
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={loading}
                className="mt-6 w-full max-w-sm rounded-2xl border border-gray-200/70 bg-white px-6 py-5 active:scale-[0.99] dark:border-white/10 dark:bg-neutral-900"
                style={buttonShadow}>
                <View className="flex-row items-center justify-center" style={{ gap: 10 }}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#4285F4" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="google" size={22} color="#4285F4" />
                      <Text className="text-base font-medium text-gray-900 dark:text-gray-100">
                        Continue with Google
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
              <Text className="mt-4 text-center text-sm text-gray-500 dark:text-gray-500">
                Use your Google account to get started.
              </Text>
            </View>

            <View className="mt-14 gap-3">
              {features.map(feature => (
                <View
                  key={feature.title}
                  className="flex-row items-start rounded-3xl border border-gray-200/60 bg-white/80 px-5 py-4 dark:border-white/10 dark:bg-white/5">
                  <View className="mr-4 mt-1 rounded-full border border-gray-200/80 p-2 dark:border-white/10">
                    <Ionicons name={feature.icon} size={18} color={iconColor} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white">{feature.title}</Text>
                    <Text className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                      {feature.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="pt-8">
            <Text className="text-center text-xs leading-relaxed text-gray-500 dark:text-gray-600">
              By continuing, you agree to our <Text className="font-semibold text-gray-700 dark:text-gray-400">Terms</Text> and{' '}
              <Text className="font-semibold text-gray-700 dark:text-gray-400">Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AuthScreen;
