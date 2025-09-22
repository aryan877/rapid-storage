import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatFileSize } from '../types/database';

const { width: screenWidth } = Dimensions.get('window');

interface StorageStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
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
      <SafeAreaView className="flex-1 bg-zinc-950">
        <View className="flex-1 items-center justify-center px-8">
          <View className="items-center">
            <View className="mb-8 h-32 w-32 items-center justify-center rounded-3xl bg-zinc-900">
              <Ionicons name="person-outline" size={48} color="#71717a" />
            </View>
            <Text className="mb-4 text-center text-3xl font-bold text-zinc-100">
              Sign In Required
            </Text>
            <Text className="max-w-sm text-center text-lg leading-relaxed text-zinc-400">
              Please sign in to view your profile and storage information
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
      <SafeAreaView className="flex-1 bg-zinc-950">
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#71717a" />
          }
          contentContainerStyle={{
            paddingHorizontal: screenWidth > 768 ? 64 : 24,
            paddingVertical: 32,
            paddingBottom: 100,
          }}>
          {/* Profile Header */}
          <View className="mb-8 items-center">
            {avatarUrl ? (
              <View className="overflow-hidden rounded-4xl shadow-lg">
                <Image source={{ uri: avatarUrl }} className="h-32 w-32" />
              </View>
            ) : (
              <View className="h-32 w-32 items-center justify-center rounded-4xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-2xl">
                <Text className="text-4xl font-bold text-white">{initials}</Text>
              </View>
            )}
            <Text className="mt-6 text-center text-4xl font-bold text-zinc-100">
              {displayName || 'User'}
            </Text>
            {displayEmail && <Text className="mt-2 text-lg text-zinc-400">{displayEmail}</Text>}
          </View>

          {/* Storage Statistics */}
          <Card variant="elevated" padding="lg" className="mb-6">
            <Text className="mb-6 text-lg font-bold text-zinc-100">Storage Overview</Text>
            {isLoading ? (
              <View className="h-24 items-center justify-center">
                <Text className="text-base text-zinc-500">Loading statistics...</Text>
              </View>
            ) : (
              <View className={`${screenWidth > 768 ? 'flex-row gap-8' : 'gap-6'}`}>
                <View
                  className={`${screenWidth > 768 ? 'flex-1' : ''} items-center rounded-2xl bg-zinc-900 p-6`}>
                  <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800">
                    <Ionicons name="document-text" size={24} color="#71717a" />
                  </View>
                  <Text className="text-3xl font-bold text-zinc-100">
                    {storageStats?.totalFiles.toLocaleString() || 0}
                  </Text>
                  <Text className="mt-1 text-sm text-zinc-500">Files</Text>
                </View>

                <View
                  className={`${screenWidth > 768 ? 'flex-1' : ''} items-center rounded-2xl bg-zinc-900 p-6`}>
                  <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800">
                    <Ionicons name="folder" size={24} color="#71717a" />
                  </View>
                  <Text className="text-3xl font-bold text-zinc-100">
                    {storageStats?.totalFolders.toLocaleString() || 0}
                  </Text>
                  <Text className="mt-1 text-sm text-zinc-500">Folders</Text>
                </View>

                <View
                  className={`${screenWidth > 768 ? 'flex-1' : ''} items-center rounded-2xl bg-zinc-900 p-6`}>
                  <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800">
                    <Ionicons name="cloud" size={24} color="#71717a" />
                  </View>
                  <Text className="text-3xl font-bold text-zinc-100">
                    {formatFileSize(storageStats?.totalSize || 0)}
                  </Text>
                  <Text className="mt-1 text-sm text-zinc-500">Used</Text>
                </View>
              </View>
            )}
          </Card>

          {/* Sign Out */}
          <Button
            title="Sign Out"
            variant="danger"
            size="lg"
            onPress={handleSignOut}
            leftIcon={<Ionicons name="log-out-outline" size={20} color="#d4d4d8" />}
            className="w-full"
          />
        </ScrollView>
      </SafeAreaView>

      {/* Sign Out Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSignOutModal}
        onRequestClose={cancelSignOut}>
        <Pressable
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onPress={cancelSignOut}>
          <Pressable className="w-full max-w-md" onPress={() => {}}>
            <Card variant="elevated" padding="lg">
              <View className="mb-6 items-center">
                <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-zinc-900">
                  <Ionicons name="log-out-outline" size={32} color="#a1a1aa" />
                </View>
                <Text className="mb-2 text-2xl font-bold text-zinc-100">Sign Out?</Text>
                <Text className="text-center text-base leading-relaxed text-zinc-400">
                  You can always sign back in later to continue managing your files.
                </Text>
              </View>

              <View className="gap-3">
                <Button
                  variant="danger"
                  size="lg"
                  title="Sign Out"
                  onPress={confirmSignOut}
                  className="w-full"
                />
                <Button
                  variant="outline"
                  size="lg"
                  title="Stay Signed In"
                  onPress={cancelSignOut}
                  className="w-full"
                />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export default ProfileScreen;
