import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
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
      className="mx-4 mb-3 flex-row items-center rounded-2xl bg-zinc-900 p-4 active:bg-zinc-800">
      <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
        <Ionicons name="folder" size={20} color="#71717a" />
      </View>
      <Text className="flex-1 text-base font-semibold text-zinc-100">{item.name}</Text>
      <Ionicons name="chevron-forward" size={18} color="#71717a" />
    </Pressable>
  );

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header with breadcrumbs */}
      <View className="border-b border-zinc-800 px-6 py-4">
        <View className="mb-4 flex-row flex-wrap items-center">
          <Pressable
            onPress={() => handleBreadcrumbNavigate(0)}
            className="mr-3 h-8 w-8 items-center justify-center rounded-xl bg-zinc-900">
            <Ionicons name="home" size={16} color="#71717a" />
          </Pressable>
          {path.slice(1).map((p, i) => (
            <View key={p.id ?? i} className="flex-row items-center">
              <Ionicons
                name="chevron-forward"
                size={14}
                color="#71717a"
                style={{ marginHorizontal: 8 }}
              />
              <Pressable onPress={() => handleBreadcrumbNavigate(i + 1)}>
                <Text
                  className={`rounded-lg px-2 py-1 text-sm ${
                    i === path.length - 2
                      ? 'bg-zinc-900 font-semibold text-zinc-100'
                      : 'text-zinc-500'
                  }`}>
                  {p.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View className="flex-row items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            title={isCreating ? 'Cancel' : 'New Folder'}
            onPress={() => {
              if (isCreating) {
                setIsCreating(false);
                setNewFolderName('');
              } else {
                setIsCreating(true);
              }
            }}
            leftIcon={<Ionicons name={isCreating ? 'close' : 'add'} size={16} color="#71717a" />}
          />
          {path.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              title="Back"
              onPress={handleGoBack}
              leftIcon={<Ionicons name="chevron-back" size={16} color="#71717a" />}
            />
          )}
        </View>

        {isCreating && (
          <View className="mt-4 gap-3">
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Enter folder name..."
              placeholderTextColor="#71717a"
              className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-base text-zinc-100"
              autoFocus
            />
            <Button
              variant="primary"
              size="md"
              title="Create Folder"
              onPress={handleCreateFolder}
              loading={createFolderMutation.isPending}
              disabled={!newFolderName.trim()}
              className="w-full"
            />
          </View>
        )}
      </View>

      {/* Folder list */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#71717a" />
          <Text className="mt-3 text-sm text-zinc-500">Loading folders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFolders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 16 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="items-center py-8">
                <ActivityIndicator size="small" color="#a1a1aa" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isLoading && filteredFolders.length === 0 ? (
              <View className="items-center justify-center px-8 py-16">
                <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-zinc-900">
                  <Ionicons name="folder-open-outline" size={32} color="#71717a" />
                </View>
                <Text className="mb-2 text-lg font-semibold text-zinc-100">No Subfolders</Text>
                <Text className="text-center text-sm text-zinc-500">
                  This folder doesn&apos;t contain any subfolders yet.
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Move button */}
      <View className="border-t border-zinc-800 px-6 py-4">
        <Button
          variant="primary"
          size="lg"
          onPress={() => onSelectFolder(activeFolderId)}
          disabled={activeFolderId === currentFolderId}
          title={`Move to "${path[path.length - 1].name}"`}
          className="w-full"
        />
      </View>
    </View>
  );
};
