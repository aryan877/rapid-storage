import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatFileSize } from '../types/database';

interface StorageStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
}

const ProfileScreen: React.FC = () => {
  const { user: authUser, signOut } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const containerClass = `flex-1 ${isDark ? 'bg-black' : 'bg-[#f7f8fb]'}`;
  const iconTint = isDark ? '#e5e7eb' : '#111827';

  const {
    data: storageStats,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['storage-stats', authUser?.id],
    queryFn: async (): Promise<StorageStats> => {
      if (!authUser) throw new Error('Not authenticated');

      // Get total files count and size
      const { data: files, error: filesError } = await supabase
        .from('files')
        .select('id, size_bytes, created_at, name, mime_type')
        .eq('user_id', authUser.id);

      if (filesError) throw filesError;

      // Get total folders count
      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', authUser.id);

      if (foldersError) throw foldersError;

      const totalSize = files?.reduce((acc, file) => acc + (file.size_bytes || 0), 0) || 0;
      return {
        totalFiles: files?.length || 0,
        totalFolders: folders?.length || 0,
        totalSize,
      };
    },
    enabled: !!authUser,
  });

  const handleSignOut = () => {
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    setShowSignOutModal(false);
    try {
      await signOut();
    } catch {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const cancelSignOut = () => {
    setShowSignOutModal(false);
  };

  if (!authUser) {
    return (
      <SafeAreaView className={containerClass}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="items-center">
            <View className="mb-6 h-20 w-20 items-center justify-center rounded-full border border-dashed border-gray-300 dark:border-white/15">
              <Ionicons name="person-outline" size={32} color={iconTint} />
            </View>
            <Text className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
              Please sign in
            </Text>
            <Text className="max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
              Log in to review your storage activity and account details.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const displayName =
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.email?.split('@')[0];
  const displayEmail = authUser.email;
  const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture;

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <>
      <SafeAreaView className={containerClass}>
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={iconTint} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="px-6 pt-8">
            <View className="items-center">
              {avatarUrl ? (
                <View className="overflow-hidden rounded-3xl border border-gray-200/70 dark:border-white/10">
                  <Image source={{ uri: avatarUrl }} className="h-28 w-28" />
                </View>
              ) : (
                <View className="h-28 w-28 items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white/80 dark:border-white/15 dark:bg-white/10">
                  <Text className="text-2xl font-semibold text-gray-900 dark:text-white">{initials}</Text>
                </View>
              )}
              <Text className="mt-6 text-2xl font-semibold text-gray-900 dark:text-white">
                {displayName || 'User'}
              </Text>
              {displayEmail && (
                <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">{displayEmail}</Text>
              )}
            </View>

            <Card variant="default" style={{ marginTop: 32 }}>
              <Text className="text-xs uppercase tracking-[0.35em] text-gray-400 dark:text-gray-500">
                Storage summary
              </Text>
              {isLoading ? (
                <View className="h-20 items-center justify-center">
                  <Text className="text-sm text-gray-500 dark:text-gray-400">Loading stats…</Text>
                </View>
              ) : (
                <View className="mt-4 gap-4">
                  <View className="flex-row items-baseline justify-between">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">Files</Text>
                    <Text className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {storageStats?.totalFiles.toLocaleString() || 0}
                    </Text>
                  </View>
                  <View className="flex-row items-baseline justify-between">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">Folders</Text>
                    <Text className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {storageStats?.totalFolders.toLocaleString() || 0}
                    </Text>
                  </View>
                  <View className="flex-row items-baseline justify-between">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">Space used</Text>
                    <Text className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {formatFileSize(storageStats?.totalSize || 0)}
                    </Text>
                  </View>
                </View>
              )}
            </Card>
            <Card variant="default" style={{ marginTop: 24 }}>
              <View className="flex-row gap-4">
                <View className="rounded-full border border-gray-200/70 p-3 dark:border-white/10">
                  <Ionicons name="mail-outline" size={20} color={iconTint} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white">Need a hand?</Text>
                  <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    support@rapidstorage.site
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const email = 'support@rapidstorage.site';
                      const subject = 'Rapid Storage - Support Request';
                      const body = 'Hi, I need help with Rapid Storage app.';
                      const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

                      import('expo-linking').then(({ default: Linking }) => {
                        Linking.openURL(mailtoUrl).catch(() => {
                          Alert.alert(
                            'Email not available',
                            'Please send an email to support@rapidstorage.site for support.'
                          );
                        });
                      });
                    }}
                    className="mt-4 self-start">
                    <Text className="text-sm font-medium text-gray-900 underline dark:text-white">Compose email</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>

            <View className="mt-32">
              <Button
                title="Sign out"
                variant="danger"
                size="lg"
                onPress={handleSignOut}
                leftIcon={<Ionicons name="log-out-outline" size={20} color="#ffffff" />}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Sign Out Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSignOutModal}
        onRequestClose={cancelSignOut}>
        <View
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
          <View className="w-full max-w-sm rounded-3xl border border-gray-200/70 bg-white/95 p-6 dark:border-white/10 dark:bg-white/5">
            <View className="items-center">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full border border-dashed border-rose-300 dark:border-rose-400/40">
                <Ionicons name="alert-circle-outline" size={28} color="#f87171" />
              </View>
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">Sign out?</Text>
              <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                You can always sign back in later to continue working.
              </Text>
            </View>

            <View className="mt-6 flex-row" style={{ gap: 12 }}>
              <Button
                variant="secondary"
                title="Stay signed in"
                className="flex-1"
                onPress={cancelSignOut}
              />
              <Button
                variant="danger"
                title="Sign out"
                className="flex-1"
                onPress={confirmSignOut}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ProfileScreen;
