import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../contexts/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

const AuthScreen: React.FC = () => {
  const { signInWithGoogle, loading } = useAuth();

  const features = [
    {
      icon: 'folder-open-outline' as const,
      title: 'Smart Organization',
      description: 'Automatically organized folders and lightning-fast search.',
      gradient: ['#52525b', '#3f3f46'],
    },
    {
      icon: 'cloud-outline' as const,
      title: 'Unlimited Space',
      description: 'Store files up to 5GB each with generous cloud storage.',
      gradient: ['#3f3f46', '#27272a'],
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Military Security',
      description: 'End-to-end encryption with enterprise-grade protection.',
      gradient: ['#27272a', '#18181b'],
    },
  ];

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: screenWidth > 768 ? 64 : 24,
          paddingVertical: 32,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View className="mb-12 items-center">
          <View className="mb-8 h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-2xl">
            <Ionicons name="cloud" size={40} color="#f4f4f5" />
          </View>

          <Text className="mb-4 text-5xl font-bold tracking-tight text-zinc-100">
            Rapid Storage
          </Text>

          <Text className="max-w-md text-center text-lg leading-relaxed text-zinc-400">
            The most beautiful way to store, organize, and access your files from anywhere.
          </Text>
        </View>

        {/* Features Grid */}
        <View className={`mb-12 ${screenWidth > 768 ? 'flex-row gap-4' : 'gap-4'}`}>
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              variant="glass"
              padding="lg"
              className={`${screenWidth > 768 ? 'flex-1' : ''}`}
              style={{ marginBottom: screenWidth > 768 ? 0 : 16 }}>
              <View className="items-center">
                <View
                  className="mb-4 h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: feature.gradient[0],
                  }}>
                  <Ionicons name={feature.icon} size={24} color="#f4f4f5" />
                </View>

                <Text className="mb-2 text-center text-lg font-semibold text-zinc-100">
                  {feature.title}
                </Text>

                <Text className="text-center text-sm leading-relaxed text-zinc-400">
                  {feature.description}
                </Text>
              </View>
            </Card>
          ))}
        </View>

        {/* Authentication Section */}
        <Card variant="elevated" padding="lg" className="mb-8">
          <View className="items-center">
            <Text className="mb-6 text-xs uppercase tracking-widest text-zinc-500">
              Get Started
            </Text>

            <Button
              onPress={handleGoogleSignIn}
              disabled={loading}
              variant="primary"
              size="lg"
              title={loading ? 'Signing in...' : 'Continue with Google'}
              leftIcon={
                loading ? (
                  <ActivityIndicator size="small" color="#09090b" />
                ) : (
                  <MaterialCommunityIcons name="google" size={20} color="#09090b" />
                )
              }
              className="w-full max-w-sm"
            />

            <Text className="mt-6 text-center text-sm leading-relaxed text-zinc-500">
              Secure authentication powered by Google
            </Text>
          </View>
        </Card>

        {/* Footer */}
        <View className="items-center pt-8">
          <Text className="max-w-md text-center text-xs leading-relaxed text-zinc-500">
            By continuing, you agree to our{' '}
            <Text className="font-medium text-zinc-400">Terms of Service</Text> and{' '}
            <Text className="font-medium text-zinc-400">Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AuthScreen;
