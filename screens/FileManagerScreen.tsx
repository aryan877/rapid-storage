import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FolderPicker } from '../components/FolderPicker';
import { useAuth } from '../contexts/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../lib/supabase';
import { File, Folder, formatFileSize, getFileIcon, type FileIconType } from '../types/database';

const PAGE_SIZE = 20;

type Item = (File | Folder) & {
  type: 'file' | 'folder';
  s3_key?: string;
  folder_id?: string | null;
  parent_id?: string | null;
  size_bytes?: number;
  mime_type?: string | null;
};

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

// Separate memoized search component to prevent keyboard issues
const SearchInput = React.memo(
  ({
    searchQuery,
    onSearchChange,
  }: {
    searchQuery: string;
    onSearchChange: (query: string) => void;
  }) => (
    <View className="mb-4">
      <View className="flex-row items-center rounded-xl bg-gray-100 px-4 dark:bg-gray-800">
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput
          placeholder="Search in this folder..."
          value={searchQuery}
          onChangeText={onSearchChange}
          className="flex-1 py-3 pl-3 text-gray-900 dark:text-white"
          placeholderTextColor="#9ca3af"
        />
      </View>
    </View>
  )
);

const FileManagerScreen: React.FC<FileManagerScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [isCreateFolderModalVisible, setIsCreateFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<
    Record<string, { progress: number; name: string }>
  >({});

  const openActionSheet = (item: Item) => {
    setSelectedItem(item);
    setIsActionSheetVisible(true);
  };

  // Memoize the search change handler to prevent unnecessary re-renders
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Memoize navigation handlers to prevent unnecessary re-renders
  const handleNavigateToUpload = useCallback(
    () => navigation.navigate('Upload', { folderId: currentFolderId }),
    [navigation, currentFolderId]
  );

  const {
    data: foldersData,
    isLoading: foldersLoading,
    refetch: refetchFolders,
    fetchNextPage: fetchNextFolders,
    hasNextPage: hasNextFolders,
    isFetchingNextPage: isFetchingNextFolders,
  } = useInfiniteQuery({
    queryKey: ['folders', currentFolderId, debouncedSearchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('folders')
        .select('*', { count: 'exact' })
        .eq('user_id', user?.id)
        .order('name')
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (debouncedSearchQuery) {
        query = query.ilike('name', `%${debouncedSearchQuery}%`);
      }

      if (currentFolderId === null) {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', currentFolderId);
      }
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as Folder[], count };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.flatMap((p) => p.data).length;
      if (lastPage.count && loadedCount < lastPage.count) {
        return allPages.length;
      }
      return undefined;
    },
    enabled: !!user,
  });

  const {
    data: filesData,
    isLoading: filesLoading,
    refetch: refetchFiles,
    fetchNextPage: fetchNextFiles,
    hasNextPage: hasNextFiles,
    isFetchingNextPage: isFetchingNextFiles,
  } = useInfiniteQuery({
    queryKey: ['files', currentFolderId, debouncedSearchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('files')
        .select('*', { count: 'exact' })
        .eq('user_id', user?.id)
        .order('name')
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (debouncedSearchQuery) {
        query = query.ilike('name', `%${debouncedSearchQuery}%`);
      }

      if (currentFolderId === null) {
        query = query.is('folder_id', null);
      } else {
        query = query.eq('folder_id', currentFolderId);
      }
      const { data, error, count } = await query;

      if (error) throw error;
      return { data: data as File[], count };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.flatMap((p) => p.data).length;
      if (lastPage.count && loadedCount < lastPage.count) {
        return allPages.length;
      }
      return undefined;
    },
    enabled: !!user,
  });

  const folders = useMemo(
    () => foldersData?.pages.flatMap((page) => page.data) ?? [],
    [foldersData]
  );
  const files = useMemo(() => filesData?.pages.flatMap((page) => page.data) ?? [], [filesData]);

  const createFolderMutation = useMutation({
    mutationFn: async (newFolderName: string) => {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          name: newFolderName.trim(),
          parent_id: currentFolderId,
          user_id: user?.id!,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders', currentFolderId] });
      setNewFolderName('');
      setIsCreateFolderModalVisible(false);
    },
    onError: (error) => {
      console.error('Error creating folder:', error);
      Alert.alert('Error', 'Failed to create folder. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: Item) => {
      if (item.type === 'folder') {
        const { error } = await supabase.from('folders').delete().eq('id', item.id);
        if (error) throw error;
      } else {
        // First, delete the record from the database
        const { error: dbError } = await supabase.from('files').delete().eq('id', item.id);
        if (dbError) throw dbError;

        // Then, delete the file from S3 via the Edge Function
        const { error: s3Error } = await supabase.functions.invoke('upload-to-s3', {
          body: {
            action: 'delete-file',
            s3Key: item.s3_key,
          },
        });
        if (s3Error) {
          // Note: You might want to handle this case more gracefully,
          // e.g., by re-inserting the DB record or logging for manual cleanup.
          console.error('S3 deletion failed, but DB record was deleted:', s3Error);
          throw new Error(`S3 deletion failed: ${s3Error.message}`);
        }
      }
    },
    onSuccess: (_, deletedItem) => {
      queryClient.invalidateQueries({ queryKey: ['folders', currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ['files', currentFolderId, debouncedSearchQuery] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
      setIsActionSheetVisible(false);
      setSelectedItem(null);
      Alert.alert('Success', `${deletedItem.name} has been deleted.`);
    },
    onError: (error, deletedItem) => {
      Alert.alert('Error', `Failed to delete ${deletedItem.name}. ${(error as Error).message}`);
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({
      item,
      destinationFolderId,
    }: {
      item: Item;
      destinationFolderId: string | null;
    }) => {
      const isMovingFolder = item.type === 'folder';
      const table = isMovingFolder ? 'folders' : 'files';
      const idColumn = isMovingFolder ? 'parent_id' : 'folder_id';

      const { error } = await supabase
        .from(table)
        .update({ [idColumn]: destinationFolderId })
        .eq('id', item.id);

      if (error) throw error;
    },
    onSuccess: (_, { item, destinationFolderId }) => {
      const sourceFolderId = item.type === 'folder' ? item.parent_id : item.folder_id;

      // Invalidate queries for both source and destination folders
      queryClient.invalidateQueries({ queryKey: ['folders', sourceFolderId] });
      queryClient.invalidateQueries({ queryKey: ['files', sourceFolderId] });
      queryClient.invalidateQueries({ queryKey: ['folders', destinationFolderId] });
      queryClient.invalidateQueries({ queryKey: ['files', destinationFolderId] });

      // Invalidate queries for the folder picker component to ensure its structure is up-to-date
      queryClient.invalidateQueries({ queryKey: ['picker-folders'] });

      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });

      setIsMoveModalVisible(false);
      setSelectedItem(null);
      Alert.alert('Success', `${item.name} has been moved.`);
    },
    onError: (error, { item }) => {
      Alert.alert('Error', `Failed to move ${item.name}. ${(error as Error).message}`);
    },
  });

  const downloadFile = async (file: Item) => {
    if (file.type !== 'file' || !file.s3_key) return;
    if (downloadingFiles[file.id]) return; // Prevent multiple downloads

    setDownloadingFiles((prev) => ({
      ...prev,
      [file.id]: { progress: 0, name: file.name },
    }));

    try {
      const { data: presignedData, error } = await supabase.functions.invoke('upload-to-s3', {
        body: {
          action: 'get-signed-url',
          s3Key: file.s3_key,
        },
      });
      if (error) throw error;

      const fileUri = FileSystem.documentDirectory + file.name;

      const downloadResumable = FileSystem.createDownloadResumable(
        presignedData.signedUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadingFiles((prev) => ({
            ...prev,
            [file.id]: { ...prev[file.id], progress },
          }));
        }
      );

      const downloadResult = await downloadResumable.downloadAsync();
      if (!downloadResult || downloadResult.status !== 200) {
        throw new Error('Failed to download file from S3.');
      }

      await Sharing.shareAsync(downloadResult.uri);
    } catch (error) {
      Alert.alert('Error', `Failed to download file. ${(error as Error).message}`);
    } finally {
      setDownloadingFiles((prev) => {
        const newDownloads = { ...prev };
        delete newDownloads[file.id];
        return newDownloads;
      });
    }
  };

  const openPreview = useCallback(async (file: Item) => {
    if (file.type !== 'file' || !file.s3_key || !file.mime_type?.startsWith('image/')) {
      Alert.alert('Preview not available', 'This file type cannot be previewed.');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('upload-to-s3', {
        body: {
          action: 'get-signed-url',
          s3Key: file.s3_key,
        },
      });
      if (error) throw error;
      setPreviewImageUrl(data.signedUrl);
    } catch (error) {
      Alert.alert('Error', `Failed to load preview. ${(error as Error).message}`);
    }
  }, []);

  const handleRefresh = () => {
    refetchFolders();
    refetchFiles();
  };

  const loadMore = () => {
    if (hasNextFolders && !isFetchingNextFolders) {
      fetchNextFolders();
    }
    if (hasNextFiles && !isFetchingNextFiles) {
      fetchNextFiles();
    }
  };

  const navigateToFolder = useCallback(
    (folder: Folder) => {
      setCurrentFolderId(folder.id);
      setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    },
    [folderPath]
  );

  const navigateToPath = useCallback(
    (index: number) => {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      setCurrentFolderId(newPath[newPath.length - 1].id);
    },
    [folderPath]
  );

  const handleGoBack = useCallback(() => {
    if (folderPath.length > 1) {
      navigateToPath(folderPath.length - 2);
    }
  }, [folderPath, navigateToPath]);

  const createFolder = useCallback(async () => {
    if (!newFolderName.trim() || createFolderMutation.isPending) return;
    createFolderMutation.mutate(newFolderName);
  }, [newFolderName, createFolderMutation]);

  const renderBreadcrumb = useCallback(
    () => (
      <View className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <View className="flex-row items-center">
          {folderPath.length > 1 && (
            <Pressable onPress={handleGoBack} className="mr-4 rounded-full p-1 active:bg-gray-200">
              <Ionicons name="arrow-back-circle" size={28} color="#3b82f6" />
            </Pressable>
          )}
          <Ionicons name="folder" size={20} color="#f59e0b" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center' }}
            className="ml-2 flex-1">
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
                    }`}
                    numberOfLines={1}>
                    {path.name}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    ),
    [folderPath, navigateToPath, handleGoBack]
  );

  const renderFolder = useCallback(
    ({ item }: { item: Folder }) => (
      <View className="mx-6 my-1 flex-row items-center rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <Pressable onPress={() => navigateToFolder(item)} className="flex-1 flex-row items-center">
          <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
            <Ionicons name="folder" size={28} color="#3b82f6" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-medium text-gray-900 dark:text-white">{item.name}</Text>
            <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {new Date(item.created_at!).toLocaleDateString()}
            </Text>
          </View>
        </Pressable>
        <Pressable
          className="ml-2 p-2"
          onPress={() => openActionSheet({ ...item, type: 'folder' })}>
          <Ionicons name="ellipsis-vertical" size={20} color="#9ca3af" />
        </Pressable>
      </View>
    ),
    [navigateToFolder]
  );

  const renderFile = useCallback(
    ({ item }: { item: File }) => (
      <View className="mx-6 my-1 flex-row items-center rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
        <Pressable
          onPress={() => openPreview({ ...item, type: 'file' })}
          className="flex-1 flex-row items-center">
          <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800">
            <FileIcon type={getFileIcon(item.mime_type || undefined)} size={28} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-medium text-gray-900 dark:text-white">{item.name}</Text>
            <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {formatFileSize(item.size_bytes)} • {new Date(item.created_at!).toLocaleDateString()}
            </Text>
          </View>
        </Pressable>
        <Pressable className="ml-2 p-2" onPress={() => openActionSheet({ ...item, type: 'file' })}>
          <Ionicons name="ellipsis-vertical" size={20} color="#9ca3af" />
        </Pressable>
      </View>
    ),
    [openPreview]
  );

  // Memoize the header component to prevent unnecessary re-renders
  const renderHeader = useMemo(
    () => (
      <>
        {renderBreadcrumb()}
        <View className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <SearchInput searchQuery={searchQuery} onSearchChange={handleSearchChange} />
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-medium text-gray-700 dark:text-gray-300">
              {folders.length + files.length} items
            </Text>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <Pressable
                onPress={() => setIsCreateFolderModalVisible(true)}
                className="flex-row items-center self-start rounded-md bg-gray-100 px-3 py-2 dark:bg-gray-800">
                <Ionicons name="folder-open" size={20} color="#3b82f6" />
                <Text className="ml-2 font-medium text-gray-700 dark:text-gray-300">
                  New Folder
                </Text>
              </Pressable>
              <Pressable
                onPress={handleNavigateToUpload}
                className="flex-row items-center rounded-lg bg-blue-600 px-4 py-2.5 active:bg-blue-700">
                <Ionicons name="cloud-upload" size={20} color="white" />
                <Text className="ml-2 font-medium text-white">Upload</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </>
    ),
    [
      searchQuery,
      handleSearchChange,
      folders.length,
      files.length,
      renderBreadcrumb,
      handleNavigateToUpload,
    ]
  );

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isCreateFolderModalVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isCreateFolderModalVisible, fadeAnim]);

  const allItems = useMemo(
    () => [
      ...folders.map((folder) => ({ ...folder, type: 'folder' as const })),
      ...files.map((file) => ({ ...file, type: 'file' as const })),
    ],
    [folders, files]
  );

  return (
    <View
      className="flex-1 bg-gray-50 dark:bg-black"
      style={{
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}>
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.type === 'folder'
            ? renderFolder({ item: item as Folder })
            : renderFile({ item: item as File })
        }
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingVertical: 8 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextFolders || isFetchingNextFiles ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginVertical: 20 }} />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={foldersLoading || filesLoading}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
        ListEmptyComponent={
          !foldersLoading && !filesLoading && allItems.length === 0 ? (
            <View className="flex-1 items-center justify-center p-16">
              <View className="mb-6 h-32 w-32 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <Ionicons name="folder-open-outline" size={64} color="#9ca3af" />
              </View>
              <Text className="mb-2 text-xl font-semibold text-gray-700 dark:text-gray-300">
                {debouncedSearchQuery ? 'No results found' : 'No files here yet'}
              </Text>
              <Text className="mb-8 text-center text-base text-gray-500 dark:text-gray-400">
                {debouncedSearchQuery
                  ? 'Try a different search term.'
                  : 'Upload files or create folders to get started'}
              </Text>
              {!debouncedSearchQuery && (
                <View className="flex-row" style={{ gap: 16 }}>
                  <Pressable
                    onPress={() => setIsCreateFolderModalVisible(true)}
                    className="rounded-lg bg-gray-200 px-6 py-3 active:bg-gray-300 dark:bg-gray-800">
                    <Text className="font-medium text-gray-700 dark:text-gray-300">
                      Create Folder
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('Upload', { folderId: currentFolderId })}
                    className="rounded-lg bg-blue-600 px-6 py-3 active:bg-blue-700">
                    <Text className="font-medium text-white">Upload Files</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null
        }
      />
      {selectedItem && (
        <Modal visible={isActionSheetVisible} transparent animationType="slide">
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setIsActionSheetVisible(false)}>
            <View className="w-[90%] max-w-md rounded-2xl bg-white p-6 dark:bg-gray-900">
              <Text className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                {selectedItem.type === 'folder'
                  ? 'Folder'
                  : `File • ${formatFileSize(selectedItem.size_bytes ?? 0)}`}
              </Text>

              {selectedItem.type === 'file' && (
                <>
                  <Pressable
                    onPress={() => openPreview(selectedItem)}
                    className="mb-3 flex-row items-center rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
                    <Ionicons name="eye-outline" size={24} color="#3b82f6" />
                    <Text className="ml-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
                      Preview
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => downloadFile(selectedItem)}
                    className="mb-3 flex-row items-center rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
                    <Ionicons name="download-outline" size={24} color="#10b981" />
                    <Text className="ml-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
                      Download
                    </Text>
                  </Pressable>
                </>
              )}

              <Pressable
                onPress={() => {
                  setIsActionSheetVisible(false);
                  setIsMoveModalVisible(true);
                }}
                className="mb-3 flex-row items-center rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
                <Ionicons name="move-outline" size={24} color="#3b82f6" />
                <Text className="ml-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Move {selectedItem.type}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Alert.alert(
                    `Delete ${selectedItem.type}`,
                    `Are you sure you want to delete "${selectedItem.name}"? This action cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel', onPress: () => {} },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => deleteMutation.mutate(selectedItem),
                      },
                    ]
                  );
                }}
                className="flex-row items-center rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
                <Text className="ml-4 text-lg font-semibold text-red-600 dark:text-red-400">
                  Delete {selectedItem.type}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
      <Modal
        visible={isCreateFolderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateFolderModalVisible(false)}>
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setIsCreateFolderModalVisible(false)}>
          <Pressable
            className="w-[90%] max-w-md rounded-2xl bg-white p-6 dark:bg-gray-900"
            onPress={() => {}}>
            <Text className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
              Create New Folder
            </Text>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name"
              placeholderTextColor="#9ca3af"
              className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              autoFocus
            />
            <View className="flex-row justify-end gap-3">
              <Pressable
                onPress={() => {
                  setIsCreateFolderModalVisible(false);
                  setNewFolderName('');
                }}
                className="rounded-lg bg-gray-200 px-5 py-3 active:bg-gray-300 dark:bg-gray-700">
                <Text className="font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={createFolder}
                disabled={createFolderMutation.isPending}
                className="min-w-[100px] items-center justify-center rounded-lg bg-blue-600 px-5 py-3 active:bg-blue-700">
                {createFolderMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="font-semibold text-white">Create</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {selectedItem && (
        <Modal visible={isMoveModalVisible} transparent animationType="slide">
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setIsMoveModalVisible(false)}>
            <Pressable
              className="h-[60%] w-[90%] max-w-md rounded-2xl bg-white dark:bg-gray-900"
              onPress={() => {}}>
              <View className="border-b border-gray-200 p-4 dark:border-gray-700">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">Move to...</Text>
              </View>
              <FolderPicker
                onSelectFolder={(destinationId) => {
                  moveMutation.mutate({ item: selectedItem, destinationFolderId: destinationId });
                }}
                currentFolderId={
                  selectedItem.type === 'folder' ? selectedItem.parent_id : selectedItem.folder_id
                }
                movingItemId={selectedItem.id}
                itemType={selectedItem.type}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {previewImageUrl && (
        <Modal
          visible={!!previewImageUrl}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewImageUrl(null)}>
          <SafeAreaView
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
            <Image
              source={{ uri: previewImageUrl }}
              className="h-full w-full"
              resizeMode="contain"
            />
            <Pressable
              onPress={() => setPreviewImageUrl(null)}
              className="absolute right-5 top-10 rounded-full bg-white/20 p-2">
              <Ionicons name="close" size={32} color="white" />
            </Pressable>
          </SafeAreaView>
        </Modal>
      )}
      {Object.values(downloadingFiles).length > 0 && (
        <View
          className="absolute bottom-5 left-5 right-5 rounded-xl bg-gray-800 p-4 shadow-lg"
          style={{
            bottom: insets.bottom + 10,
            left: insets.left + 10,
            right: insets.right + 10,
          }}>
          {Object.values(downloadingFiles).map((download) => (
            <View key={download.name} className="mb-2">
              <Text className="mb-1 text-white">Downloading {download.name}...</Text>
              <View className="h-2 rounded-full bg-gray-600">
                <View
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${download.progress * 100}%` }}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default FileManagerScreen;
