import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

const AuthScreen: React.FC = () => {
  const { signInWithGoogle, loading } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="flex-1 justify-between px-8 py-12">
          {/* App Branding */}
          <View className="flex-1 justify-center">
            <View className="mb-12 items-center">
              {/* Logo with gradient shadow */}
              <View className="mb-8 h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-pink-500 shadow-2xl">
                <Ionicons name="cloud-upload" size={56} color="white" />
              </View>

              <Text className="mb-3 text-center text-5xl font-black tracking-tight text-gray-900 dark:text-white">
                Rita&apos;s Storage
              </Text>
              <Text className="mb-2 text-center text-xl font-medium text-orange-600 dark:text-orange-400">
                Cloud Storage Reimagined
              </Text>
              <Text className="max-w-xs text-center text-base leading-relaxed text-gray-600 dark:text-gray-400">
                Seamlessly store, organize, and access your files from anywhere
              </Text>
            </View>

            {/* Authentication Section */}
            <View className="mb-16">
              <Text className="mb-10 text-center text-3xl font-bold text-gray-900 dark:text-white">
                Welcome Back
              </Text>

              <View className="gap-4">
                {/* Google Sign-In with modern styling */}
                <TouchableOpacity
                  onPress={handleGoogleSignIn}
                  disabled={loading}
                  className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-lg active:scale-[0.98] dark:bg-gray-900"
                  style={{
                    shadowOffset: { width: 0, height: 4 },
                    shadowRadius: 12,
                    shadowOpacity: 0.15,
                    elevation: 8,
                  }}>
                  <View
                    className="flex-row items-center justify-center border border-gray-200 px-8 py-5 dark:border-gray-800"
                    style={{ gap: 12 }}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#4285F4" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="google" size={24} color="#4285F4" />
                        <Text className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                          Continue with Google
                        </Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Alternative sign-in hint */}
                <Text className="mt-6 text-center text-sm text-gray-500 dark:text-gray-500">
                  More sign-in options coming soon
                </Text>
              </View>
            </View>

            {/* Features Grid */}
            <View className="mb-12">
              <View className="gap-4">
                <View className="flex-row items-center rounded-2xl bg-blue-50 p-5 dark:bg-blue-950">
                  <View className="mr-4 h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 opacity-20">
                    <Ionicons name="folder-open" size={28} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                      Smart Organization
                    </Text>
                    <Text className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      Nested folders & instant search
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center rounded-2xl bg-green-50 p-5 dark:bg-green-950">
                  <View className="mr-4 h-14 w-14 items-center justify-center rounded-2xl bg-green-500 opacity-20">
                    <Ionicons name="cloud-done" size={28} color="#10b981" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                      5GB File Support
                    </Text>
                    <Text className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      Upload any file type seamlessly
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center rounded-2xl bg-purple-50 p-5 dark:bg-purple-950">
                  <View className="mr-4 h-14 w-14 items-center justify-center rounded-2xl bg-purple-500 opacity-20">
                    <Ionicons name="shield-checkmark" size={28} color="#8b5cf6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                      Enterprise Security
                    </Text>
                    <Text className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      AWS S3 with end-to-end encryption
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Terms - Fixed at bottom */}
          <View className="pt-8">
            <Text className="text-center text-xs leading-relaxed text-gray-500 dark:text-gray-600">
              By continuing, you agree to our{' '}
              <Text className="font-semibold text-gray-700 dark:text-gray-400">Terms</Text> and{' '}
              <Text className="font-semibold text-gray-700 dark:text-gray-400">Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AuthScreen;
