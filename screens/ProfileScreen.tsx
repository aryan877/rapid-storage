import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { File } from '../types/database';
import { formatFileSize } from '../types/database';

interface StorageStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  recentFiles: File[];
}

const ProfileScreen: React.FC = () => {
  const { user: authUser, signOut } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

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
      const recentFiles =
        files
          ?.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
          .slice(0, 5) || [];

      return {
        totalFiles: files?.length || 0,
        totalFolders: folders?.length || 0,
        totalSize,
        recentFiles: recentFiles as File[],
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
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
        <View className="flex-1 items-center justify-center px-8">
          <View className="items-center">
            <View className="mb-8 h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <Ionicons name="person-outline" size={48} color="#6b7280" />
            </View>
            <Text className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
              Please Log In
            </Text>
            <Text className="mb-8 max-w-sm text-center text-base text-gray-600 dark:text-gray-400">
              You need to be logged in to view your profile and storage stats.
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
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Header with gradient background */}
          <View className="relative overflow-hidden bg-blue-600 px-8 pb-12 pt-8">
            {/* Profile Info */}
            <View className="items-center">
              {avatarUrl ? (
                <View className="mb-6 overflow-hidden rounded-full border-4 border-white/20 shadow-xl">
                  <Image source={{ uri: avatarUrl }} className="h-36 w-36" />
                </View>
              ) : (
                <View className="mb-6 h-36 w-36 items-center justify-center rounded-full border-4 border-white/20 bg-white shadow-xl">
                  <Text className="text-5xl font-bold text-blue-600">{initials}</Text>
                </View>
              )}

              <Text className="mb-2 text-center text-3xl font-bold text-white">
                {displayName || 'User'}
              </Text>

              {displayEmail && (
                <Text className="text-center text-base text-white opacity-90">{displayEmail}</Text>
              )}
            </View>
          </View>

          <View className="px-6 py-8">
            {/* Storage Stats */}
            <View className="mb-8">
              <Text className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
                Storage Overview
              </Text>

              {isLoading ? (
                <View className="h-32 items-center justify-center">
                  <Text className="text-gray-500 dark:text-gray-400">Loading storage stats...</Text>
                </View>
              ) : (
                <View className="flex-row gap-4">
                  <View className="flex-1 overflow-hidden rounded-2xl bg-blue-500 p-5 shadow-sm">
                    <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-white opacity-20">
                      <Ionicons name="document" size={24} color="white" />
                    </View>
                    <Text className="text-3xl font-bold text-white">
                      {storageStats?.totalFiles.toLocaleString() || 0}
                    </Text>
                    <Text className="mt-1 text-sm font-medium text-white opacity-80">Files</Text>
                  </View>

                  <View className="flex-1 overflow-hidden rounded-2xl bg-green-500 p-5 shadow-sm">
                    <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-white opacity-20">
                      <Ionicons name="folder" size={24} color="white" />
                    </View>
                    <Text className="text-3xl font-bold text-white">
                      {storageStats?.totalFolders.toLocaleString() || 0}
                    </Text>
                    <Text className="mt-1 text-sm font-medium text-white opacity-80">Folders</Text>
                  </View>

                  <View className="flex-1 overflow-hidden rounded-2xl bg-purple-500 p-5 shadow-sm">
                    <View className="mb-3 h-12 w-12 items-center justify-center rounded-xl bg-white opacity-20">
                      <Ionicons name="cloud" size={24} color="white" />
                    </View>
                    <Text className="text-3xl font-bold text-white">
                      {formatFileSize(storageStats?.totalSize || 0).split(' ')[0]}
                    </Text>
                    <Text className="mt-1 text-sm font-medium text-white opacity-80">
                      {formatFileSize(storageStats?.totalSize || 0).split(' ')[1]}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Recent Files */}
            <View className="mb-8">
              <View className="mb-6 flex-row items-center justify-between">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                  Recent Files
                </Text>
                <Ionicons name="time-outline" size={24} color="#6b7280" />
              </View>

              {isLoading ? (
                <View className="h-32 items-center justify-center">
                  <Text className="text-gray-500 dark:text-gray-400">Loading recent files...</Text>
                </View>
              ) : storageStats?.recentFiles && storageStats.recentFiles.length > 0 ? (
                <View className="gap-3">
                  {storageStats.recentFiles.map((file) => (
                    <Pressable
                      key={file.id}
                      className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm active:scale-[0.98] dark:bg-gray-900">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="mb-1 text-base font-semibold text-gray-900 dark:text-white">
                            {file.name}
                          </Text>
                          <Text className="text-sm text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size_bytes)} • {file.mime_type || 'Unknown type'}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-xs font-medium text-gray-400 dark:text-gray-500">
                            {new Date(file.created_at!).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View className="items-center rounded-2xl bg-gray-100 py-16 dark:bg-gray-900">
                  <Ionicons name="document-outline" size={48} color="#9ca3af" />
                  <Text className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
                    No Files Yet
                  </Text>
                  <Text className="mt-2 text-center text-gray-500 dark:text-gray-400">
                    Upload your first file to get started!
                  </Text>
                </View>
              )}
            </View>

            {/* Support Contact */}
            <View className="mb-8">
              <Text className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
                Need Help?
              </Text>

              <Pressable
                onPress={() => {
                  // Open email client with pre-filled email
                  const email = 'aryankumar877@gmail.com';
                  const subject = "Rita's Storage - Support Request";
                  const body = "Hi, I need help with Rita's Storage app.";
                  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

                  import('expo-linking').then(({ default: Linking }) => {
                    Linking.openURL(mailtoUrl).catch(() => {
                      Alert.alert(
                        'Email not available',
                        'Please send an email to aryankumar877@gmail.com for support.'
                      );
                    });
                  });
                }}
                className="flex-row items-center rounded-2xl bg-white p-5 shadow-sm active:scale-[0.98] dark:bg-gray-900">
                <View className="mr-4 h-14 w-14 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950">
                  <Ionicons name="mail-outline" size={28} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                    Contact Support
                  </Text>
                  <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    aryankumar877@gmail.com
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </Pressable>
            </View>

            {/* Sign Out */}
            <TouchableOpacity
              className="flex-row items-center justify-center rounded-2xl bg-red-500 py-4 shadow-sm active:bg-red-600"
              onPress={handleSignOut}>
              <Ionicons name="log-out" size={24} color="white" style={{ marginRight: 8 }} />
              <Text className="text-lg font-semibold text-white">Sign Out</Text>
            </TouchableOpacity>
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
          <View className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl dark:bg-gray-900">
            <View className="p-8">
              <View className="mb-6 items-center">
                <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
                  <Ionicons name="log-out" size={36} color="#ef4444" />
                </View>
                <Text className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                  Sign Out?
                </Text>
                <Text className="text-center text-base text-gray-600 dark:text-gray-400">
                  Are you sure you want to sign out of your account?
                </Text>
              </View>

              <View className="gap-3">
                <TouchableOpacity
                  className="rounded-xl bg-red-500 py-4 active:bg-red-600"
                  onPress={confirmSignOut}>
                  <Text className="text-center text-base font-semibold text-white">
                    Yes, Sign Out
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="rounded-xl border border-gray-200 bg-white py-4 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                  onPress={cancelSignOut}>
                  <Text className="text-center text-base font-semibold text-gray-700 dark:text-gray-300">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ProfileScreen;
