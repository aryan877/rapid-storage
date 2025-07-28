import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Folder } from '../types/database';

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
  const queryClient = useQueryClient();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [path, setPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['picker-folders', activeFolderId],
    queryFn: async () => {
      let query = supabase.from('folders').select('*').eq('user_id', user!.id).order('name');

      if (activeFolderId === null) {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', activeFolderId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Folder[];
    },
    enabled: !!user,
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          name: name.trim(),
          parent_id: activeFolderId,
          user_id: user?.id!,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picker-folders', activeFolderId] });
      setNewFolderName('');
      setIsCreating(false);
    },
    onError: (error) => {
      Alert.alert('Error', `Failed to create folder: ${(error as Error).message}`);
    },
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName);
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

  const filteredFolders = folders.filter((folder) => {
    if (itemType === 'folder' && folder.id === movingItemId) {
      return false; // Prevent moving a folder into itself
    }
    return true;
  });

  const renderItem = ({ item }: { item: Folder }) => (
    <Pressable
      onPress={() => handleNavigate(item)}
      className="my-1 flex-row items-center rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
      <Ionicons name="folder-outline" size={24} color="#3b82f6" style={{ marginRight: 12 }} />
      <Text className="flex-1 text-base text-gray-800 dark:text-gray-200">{item.name}</Text>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </Pressable>
  );

  return (
    <View className="flex-1">
      <View className="border-b border-gray-200 p-3 dark:border-gray-700">
        <View className="mb-3 flex-row flex-wrap items-center">
          <Pressable onPress={() => handleBreadcrumbNavigate(0)}>
            <Ionicons name="home-outline" size={20} color="#3b82f6" />
          </Pressable>
          {path.slice(1).map((p, i) => (
            <View key={p.id} className="flex-row items-center">
              <Ionicons
                name="chevron-forward"
                size={16}
                color="#9ca3af"
                style={{ marginHorizontal: 4 }}
              />
              <Pressable onPress={() => handleBreadcrumbNavigate(i + 1)}>
                <Text
                  className={`text-base ${i === path.length - 2 ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
                  {p.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => setIsCreating(!isCreating)}
            className="flex-row items-center self-start rounded-md bg-blue-50 px-3 py-2 dark:bg-blue-900/50">
            <Ionicons name={isCreating ? 'close' : 'add'} size={20} color="#3b82f6" />
            <Text className="ml-2 font-medium text-blue-600">New Folder</Text>
          </Pressable>
          {path.length > 1 && (
            <Pressable
              onPress={handleGoBack}
              className="flex-row items-center self-start rounded-md bg-gray-100 px-3 py-2 dark:bg-gray-800">
              <Ionicons name="arrow-back" size={20} color="#6b7280" />
              <Text className="ml-2 font-medium text-gray-700 dark:text-gray-300">Back</Text>
            </Pressable>
          )}
        </View>
        {isCreating && (
          <View className="mt-3 flex-row gap-2">
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name"
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              autoFocus
            />
            <Pressable
              onPress={handleCreateFolder}
              disabled={createFolderMutation.isPending}
              className="items-center justify-center rounded-md bg-blue-600 px-4 py-2">
              {createFolderMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="font-semibold text-white">Create</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredFolders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          ListEmptyComponent={
            <View className="items-center justify-center p-8">
              <Ionicons name="folder-open-outline" size={48} color="#9ca3af" />
              <Text className="mt-4 text-gray-500">No sub-folders here</Text>
            </View>
          }
        />
      )}

      <View className="border-t border-gray-200 p-4 dark:border-gray-700">
        <Pressable
          onPress={() => onSelectFolder(activeFolderId)}
          disabled={activeFolderId === currentFolderId}
          className={`rounded-lg py-3 ${
            activeFolderId === currentFolderId
              ? 'bg-gray-300 dark:bg-gray-700'
              : 'bg-blue-600 active:bg-blue-700'
          }`}>
          <Text className="text-center text-lg font-bold text-white">
            Move to {path[path.length - 1].name}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
