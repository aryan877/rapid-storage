import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { File, Folder, formatFileSize, getFileIcon, type FileIconType } from '../types/database';

interface FileManagerScreenProps {
  navigation: any;
}

const FileIcon: React.FC<{ type: FileIconType; size?: number }> = ({ type, size = 24 }) => {
  const iconMap: Record<FileIconType, { name: string; color: string }> = {
    document: { name: 'document-text', color: '#3b82f6' },
    image: { name: 'image', color: '#10b981' },
    video: { name: 'videocam', color: '#ef4444' },
    audio: { name: 'musical-notes', color: '#8b5cf6' },
    archive: { name: 'archive', color: '#f59e0b' },
    code: { name: 'code-slash', color: '#06b6d4' },
    pdf: { name: 'document', color: '#dc2626' },
    spreadsheet: { name: 'grid', color: '#22c55e' },
    presentation: { name: 'easel', color: '#f97316' },
    text: { name: 'document-text', color: '#6b7280' },
    unknown: { name: 'document', color: '#9ca3af' },
  };

  const icon = iconMap[type];
  return <Ionicons name={icon.name as any} size={size} color={icon.color} />;
};

const FileManagerScreen: React.FC<FileManagerScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];

  const {
    data: folders = [],
    isLoading: foldersLoading,
    refetch: refetchFolders,
  } = useQuery({
    queryKey: ['folders', currentFolderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('parent_id', currentFolderId)
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      return data as Folder[];
    },
    enabled: !!user,
  });

  const {
    data: files = [],
    isLoading: filesLoading,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ['files', currentFolderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('folder_id', currentFolderId)
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      return data as File[];
    },
    enabled: !!user,
  });

  const handleRefresh = () => {
    refetchFolders();
    refetchFiles();
  };

  const navigateToFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  const navigateToPath = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1].id);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const { error } = await supabase.from('folders').insert({
        name: newFolderName.trim(),
        parent_id: currentFolderId,
        user_id: user?.id!,
      });

      if (error) throw error;

      setNewFolderName('');
      setIsCreatingFolder(false);
      handleRefresh();
    } catch (error) {
      console.error('Error creating folder:', error);
      Alert.alert('Error', 'Failed to create folder');
    }
  };

  const renderBreadcrumb = () => (
    <View className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
      <View className="flex-row items-center">
        <Text className="mr-2 text-lg font-semibold text-gray-600 dark:text-gray-400">
          <Ionicons name="folder" size={20} color="#f59e0b" />
        </Text>
        {folderPath.map((path, index) => (
          <View key={index} className="flex-row items-center">
            {index > 0 && (
              <Ionicons
                name="chevron-forward"
                size={16}
                color="#9ca3af"
                style={{ marginHorizontal: 8 }}
              />
            )}
            <Pressable onPress={() => navigateToPath(index)}>
              <Text
                className={`text-base ${
                  index === folderPath.length - 1
                    ? 'font-semibold text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                {path.name}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );

  const renderFolder = ({ item }: { item: Folder }) => (
    <Pressable
      onPress={() => navigateToFolder(item)}
      className="mx-6 my-1 flex-row items-center rounded-xl bg-white p-4 shadow-sm active:scale-[0.98] dark:bg-gray-900"
      style={{
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        shadowOpacity: 0.05,
        elevation: 2,
      }}>
      <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
        <Ionicons name="folder" size={28} color="#3b82f6" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900 dark:text-white">{item.name}</Text>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {new Date(item.created_at!).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </Pressable>
  );

  const renderFile = ({ item }: { item: File }) => (
    <Pressable
      className="mx-6 my-1 flex-row items-center rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900"
      style={{
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        shadowOpacity: 0.05,
        elevation: 2,
      }}>
      <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800">
        <FileIcon type={getFileIcon(item.mime_type || undefined)} size={28} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900 dark:text-white">{item.name}</Text>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {formatFileSize(item.size_bytes)} • {new Date(item.created_at!).toLocaleDateString()}
        </Text>
      </View>
      <Pressable className="ml-2 p-2">
        <Ionicons name="ellipsis-vertical" size={20} color="#9ca3af" />
      </Pressable>
    </Pressable>
  );

  const renderCreateFolderInput = () => (
    <Animated.View
      style={{ opacity: fadeAnim }}
      className="mx-6 my-2 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/20">
      <View className="flex-row items-center">
        <TextInput
          value={newFolderName}
          onChangeText={setNewFolderName}
          placeholder="Folder name"
          placeholderTextColor="#9ca3af"
          className="mr-3 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          autoFocus
        />
        <Pressable
          onPress={createFolder}
          className="mr-2 rounded-lg bg-blue-600 px-5 py-3 active:bg-blue-700">
          <Text className="font-semibold text-white">Create</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setIsCreatingFolder(false);
            setNewFolderName('');
          }}
          className="rounded-lg bg-gray-200 px-5 py-3 active:bg-gray-300 dark:bg-gray-700">
          <Text className="font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
        </Pressable>
      </View>
    </Animated.View>
  );

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isCreatingFolder ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isCreatingFolder, fadeAnim]);

  const allItems = [
    ...folders.map((folder) => ({ ...folder, type: 'folder' as const })),
    ...files.map((file) => ({ ...file, type: 'file' as const })),
  ];

  return (
    <View
      className="flex-1 bg-gray-50 dark:bg-black"
      style={{
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}>
      {renderBreadcrumb()}

      {/* Toolbar */}
      <View className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-medium text-gray-700 dark:text-gray-300">
            {folders.length + files.length} items
          </Text>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Pressable
              onPress={() => setIsCreatingFolder(true)}
              className="flex-row items-center rounded-lg bg-gray-100 px-4 py-2.5 active:bg-gray-200 dark:bg-gray-800 dark:active:bg-gray-700">
              <Ionicons name="folder-open" size={20} color="#3b82f6" />
              <Text className="ml-2 font-medium text-gray-700 dark:text-gray-300">New Folder</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Upload', { folderId: currentFolderId })}
              className="flex-row items-center rounded-lg bg-blue-600 px-4 py-2.5 active:bg-blue-700">
              <Ionicons name="cloud-upload" size={20} color="white" />
              <Text className="ml-2 font-medium text-white">Upload</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {isCreatingFolder && renderCreateFolderInput()}

      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.type === 'folder' ? renderFolder({ item }) : renderFile({ item })
        }
        contentContainerStyle={{ paddingVertical: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={foldersLoading || filesLoading}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-16">
            <View className="mb-6 h-32 w-32 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <Ionicons name="folder-open-outline" size={64} color="#9ca3af" />
            </View>
            <Text className="mb-2 text-xl font-semibold text-gray-700 dark:text-gray-300">
              No files here yet
            </Text>
            <Text className="mb-8 text-center text-base text-gray-500 dark:text-gray-400">
              Upload files or create folders to get started
            </Text>
            <View className="flex-row" style={{ gap: 16 }}>
              <Pressable
                onPress={() => setIsCreatingFolder(true)}
                className="rounded-lg bg-gray-200 px-6 py-3 active:bg-gray-300 dark:bg-gray-800">
                <Text className="font-medium text-gray-700 dark:text-gray-300">Create Folder</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Upload', { folderId: currentFolderId })}
                className="rounded-lg bg-blue-600 px-6 py-3 active:bg-blue-700">
                <Text className="font-medium text-white">Upload Files</Text>
              </Pressable>
            </View>
          </View>
        }
      />
    </View>
  );
};

export default FileManagerScreen;
