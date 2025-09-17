import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useCreateFolderMutation, usePickerFoldersQuery } from '../queries';
import { Folder } from '../types/database';
import Button from './Button';


interface FolderPickerProps {
  onSelectFolder: (folderId: string | null) => void;
  currentFolderId?: string | null;
  movingItemId?: string;
  itemType?: 'file' | 'folder';
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  onSelectFolder,
  currentFolderId,
  movingItemId,
  itemType,
}) => {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconTint = isDark ? '#e5e7eb' : '#111827';
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [path, setPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const {
    data: foldersData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePickerFoldersQuery(user?.id, activeFolderId);

  const folders = useMemo(
    () => foldersData?.pages.flatMap((page) => page.data) ?? [],
    [foldersData]
  );

  const createFolderMutation = useCreateFolderMutation();

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user?.id) return;

    try {
      await createFolderMutation.mutateAsync({
        name: newFolderName,
        parentId: activeFolderId,
        userId: user.id,
      });
      setNewFolderName('');
      setIsCreating(false);
    } catch (error) {
      Alert.alert('Error', `Failed to create folder: ${(error as Error).message}`);
    }
  };

  const handleNavigate = (folder: Folder) => {
    setActiveFolderId(folder.id);
    setPath([...path, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbNavigate = (index: number) => {
    const newPath = path.slice(0, index + 1);
    setPath(newPath);
    setActiveFolderId(newPath[newPath.length - 1].id);
  };

  const handleGoBack = () => {
    if (path.length > 1) {
      handleBreadcrumbNavigate(path.length - 2);
    }
  };

  const filteredFolders = folders.filter((folder: Folder) => {
    if (itemType === 'folder' && folder.id === movingItemId) {
      return false; // Prevent moving a folder into itself
    }
    return true;
  });

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderItem = ({ item }: { item: Folder }) => (
    <Pressable
      onPress={() => handleNavigate(item)}
      className="my-1 flex-row items-center rounded-2xl border border-gray-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-white/5">
      <Ionicons name="folder-outline" size={20} color={iconTint} style={{ marginRight: 12 }} />
      <Text className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</Text>
      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
    </Pressable>
  );

  return (
    <View className="flex-1">
      <View className="border-b border-gray-200/60 px-4 py-4 dark:border-white/10">
        <View className="flex-row flex-wrap items-center">
          <Pressable
            onPress={() => handleBreadcrumbNavigate(0)}
            className="mr-2 rounded-full border border-gray-200/70 p-2 dark:border-white/10">
            <Ionicons name="home-outline" size={16} color={iconTint} />
          </Pressable>
          {path.slice(1).map((p, i) => (
            <View key={p.id ?? i} className="flex-row items-center">
              <Text className="mx-2 text-sm text-gray-400">/</Text>
              <Pressable onPress={() => handleBreadcrumbNavigate(i + 1)}>
                <Text
                  className={`text-sm ${
                    i === path.length - 2 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500'
                  }`}>
                  {p.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
        <View className="mt-4 flex-row items-center justify-between">
          <Button
            variant="secondary"
            title={isCreating ? 'Cancel' : 'New folder'}
            onPress={() => {
              if (isCreating) {
                setIsCreating(false);
                setNewFolderName('');
              } else {
                setIsCreating(true);
              }
            }}
            leftIcon={<Ionicons name={isCreating ? 'close' : 'add'} size={16} color={iconTint} />}
          />
          {path.length > 1 && (
            <Pressable
              onPress={handleGoBack}
              className="flex-row items-center rounded-full border border-gray-200/70 px-3 py-1.5 dark:border-white/10">
              <Ionicons name="arrow-back" size={16} color={iconTint} />
              <Text className="ml-2 text-sm text-gray-600 dark:text-gray-300">Up one level</Text>
            </Pressable>
          )}
        </View>
        {isCreating && (
          <View className="mt-3 flex-row gap-2">
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name"
              className="flex-1 rounded-xl border border-gray-200/70 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/10 dark:text-white"
              autoFocus
            />
            <Button
              title="Create"
              onPress={handleCreateFolder}
              loading={createFolderMutation.isPending}
            />
          </View>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={iconTint} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredFolders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator size="small" color={iconTint} style={{ marginVertical: 20 }} />
            ) : null
          }
          ListEmptyComponent={
            !isLoading && filteredFolders.length === 0 ? (
              <View className="items-center justify-center p-8">
                <View className="mb-4 h-14 w-14 items-center justify-center rounded-full border border-dashed border-gray-300 dark:border-white/15">
                  <Ionicons name="folder-open-outline" size={22} color={iconTint} />
                </View>
                <Text className="text-sm text-gray-500 dark:text-gray-400">No sub-folders here</Text>
              </View>
            ) : null
          }
        />
      )}

      <View className="border-t border-gray-200/60 px-4 py-4 dark:border-white/10">
        <Button
          onPress={() => onSelectFolder(activeFolderId)}
          disabled={activeFolderId === currentFolderId}
          title={`Move to ${path[path.length - 1].name}`}
        />
      </View>
    </View>
  );
};
