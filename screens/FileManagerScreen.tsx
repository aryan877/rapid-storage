import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/Button';
import { FolderPicker } from '../components/FolderPicker';
import { useAuth } from '../contexts/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../lib/supabase';
import {
  useCreateFolderMutation,
  useDeleteFileMutation,
  useDeleteFolderMutation,
  useFilesQuery,
  useFoldersQuery,
  useMoveFileMutation,
  useMoveFolderMutation,
} from '../queries';
import { File, Folder, formatFileSize, getFileIcon, type FileIconType } from '../types/database';


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
  const glyphMap: Record<FileIconType, string> = {
    document: 'document-text',
    image: 'image',
    video: 'videocam',
    audio: 'musical-notes',
    archive: 'archive',
    code: 'code-slash',
    pdf: 'document',
    spreadsheet: 'grid',
    presentation: 'easel',
    text: 'document-text',
    unknown: 'document',
  };

  const colorScheme = useColorScheme();
  const tint = colorScheme === 'dark' ? '#e5e7eb' : '#111827';
  return <Ionicons name={glyphMap[type] as any} size={size} color={tint} />;
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
    <View className="mb-5">
      <View className="flex-row items-center rounded-xl border border-gray-200/70 bg-white px-4 dark:border-white/10 dark:bg-white/5">
        <Ionicons name="search" size={18} color="#9ca3af" />
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#e5e7eb' : '#111827';
  const containerClass = `flex-1 ${isDark ? 'bg-black' : 'bg-[#f7f8fb]'}`;
  const primaryButtonIconColor = isDark ? '#111827' : '#ffffff';
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

  const openActionSheet = useCallback((item: Item) => {
    setSelectedItem(item);
    setIsActionSheetVisible(true);
  }, []);

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
  } = useFoldersQuery(user?.id, currentFolderId, debouncedSearchQuery);

  const {
    data: filesData,
    isLoading: filesLoading,
    refetch: refetchFiles,
    fetchNextPage: fetchNextFiles,
    hasNextPage: hasNextFiles,
    isFetchingNextPage: isFetchingNextFiles,
  } = useFilesQuery(user?.id, currentFolderId, debouncedSearchQuery);

  const folders = useMemo(
    () => foldersData?.pages.flatMap((page) => page.data) ?? [],
    [foldersData]
  );
  const files = useMemo(() => filesData?.pages.flatMap((page) => page.data) ?? [], [filesData]);

  const createFolderMutation = useCreateFolderMutation();

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || createFolderMutation.isPending || !user?.id) return;

    try {
      await createFolderMutation.mutateAsync({
        name: newFolderName,
        parentId: currentFolderId,
        userId: user.id,
      });
      setNewFolderName('');
      setIsCreateFolderModalVisible(false);
    } catch (error) {
      console.error('Error creating folder:', error);
      Alert.alert('Error', 'Failed to create folder. Please try again.');
    }
  };

  const deleteFolderMutation = useDeleteFolderMutation();
  const deleteFileMutation = useDeleteFileMutation();

  const handleDelete = async (item: Item) => {
    try {
      if (item.type === 'folder') {
        await deleteFolderMutation.mutateAsync(item.id);
      } else {
        await deleteFileMutation.mutateAsync({
          fileId: item.id,
          s3Key: item.s3_key!,
        });
      }
      setIsActionSheetVisible(false);
      setSelectedItem(null);
      Alert.alert('Success', `${item.name} has been deleted.`);
    } catch (error) {
      Alert.alert('Error', `Failed to delete ${item.name}. ${(error as Error).message}`);
    }
  };

  const moveFolderMutation = useMoveFolderMutation();
  const moveFileMutation = useMoveFileMutation();

  const handleMove = async (item: Item, destinationFolderId: string | null) => {
    try {
      if (item.type === 'folder') {
        await moveFolderMutation.mutateAsync({
          folderId: item.id,
          destinationFolderId,
        });
      } else {
        await moveFileMutation.mutateAsync({
          fileId: item.id,
          destinationFolderId,
        });
      }
      setIsMoveModalVisible(false);
      setSelectedItem(null);
      Alert.alert('Success', `${item.name} has been moved.`);
    } catch (error) {
      Alert.alert('Error', `Failed to move ${item.name}. ${(error as Error).message}`);
    }
  };

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
    handleCreateFolder();
  }, [newFolderName, createFolderMutation.isPending, handleCreateFolder]);

  const renderBreadcrumb = useCallback(
    () => (
      <View className="px-6 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-gray-900 dark:text-white">
            {folderPath[folderPath.length - 1]?.name || 'My Drive'}
          </Text>
          {folderPath.length > 1 && (
            <Pressable
              onPress={handleGoBack}
              className="rounded-full border border-gray-200/70 px-3 py-1.5 dark:border-white/10">
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-300">Up one level</Text>
            </Pressable>
          )}
        </View>
        {folderPath.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ alignItems: 'center' }}>
            {folderPath.map((path, index) => (
              <View key={path.id ?? index} className="flex-row items-center">
                {index > 0 && <Text className="mx-2 text-sm text-gray-400">/</Text>}
                <Pressable onPress={() => navigateToPath(index)}>
                  <Text
                    className={`text-sm ${
                      index === folderPath.length - 1
                        ? 'font-medium text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                    numberOfLines={1}>
                    {path.name}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    ),
    [folderPath, navigateToPath, handleGoBack]
  );

  const renderFolder = useCallback(
    ({ item }: { item: Folder }) => (
      <View className="mx-5 my-1 flex-row items-center rounded-2xl border border-gray-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <Pressable onPress={() => navigateToFolder(item)} className="flex-1 flex-row items-center">
          <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl border border-gray-200/70 bg-white dark:border-white/10 dark:bg-transparent">
            <Ionicons name="folder-outline" size={22} color={iconColor} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-medium text-gray-900 dark:text-white">{item.name}</Text>
            <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {new Date(item.created_at!).toLocaleDateString()}
            </Text>
          </View>
        </Pressable>
        <Pressable
          className="ml-2 rounded-full border border-gray-200/70 p-2 dark:border-white/10"
          onPress={() => openActionSheet({ ...item, type: 'folder' })}>
          <Ionicons name="ellipsis-horizontal" size={18} color={iconColor} />
        </Pressable>
      </View>
    ),
    [navigateToFolder, iconColor, openActionSheet]
  );

  const renderFile = useCallback(
    ({ item }: { item: File }) => (
      <View className="mx-5 my-1 flex-row items-center rounded-2xl border border-gray-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <Pressable
          onPress={() => openPreview({ ...item, type: 'file' })}
          className="flex-1 flex-row items-center">
          <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl border border-gray-200/70 bg-white dark:border-white/10 dark:bg-transparent">
            <FileIcon type={getFileIcon(item.mime_type || undefined)} size={22} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-medium text-gray-900 dark:text-white">{item.name}</Text>
            <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {formatFileSize(item.size_bytes)} • {new Date(item.created_at!).toLocaleDateString()}
            </Text>
          </View>
        </Pressable>
        <Pressable
          className="ml-2 rounded-full border border-gray-200/70 p-2 dark:border-white/10"
          onPress={() => openActionSheet({ ...item, type: 'file' })}>
          <Ionicons name="ellipsis-horizontal" size={18} color={iconColor} />
        </Pressable>
      </View>
    ),
    [openPreview, iconColor, openActionSheet]
  );

  // Memoize the header component to prevent unnecessary re-renders
  const renderHeader = useMemo(
    () => (
      <>
        {renderBreadcrumb()}
        <View className="px-6">
          <View className="mt-6 rounded-2xl border border-gray-200/60 bg-white/90 p-5 dark:border-white/10 dark:bg-white/5">
            <SearchInput searchQuery={searchQuery} onSearchChange={handleSearchChange} />
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {folders.length + files.length} item
                {folders.length + files.length === 1 ? '' : 's'} in this view
              </Text>
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <Button
                  variant="secondary"
                  title="New Folder"
                  leftIcon={<Ionicons name="add-circle-outline" size={18} color={iconColor} />}
                  onPress={() => setIsCreateFolderModalVisible(true)}
                />
                <Button
                  title="Upload"
                  leftIcon={<Ionicons name="cloud-upload-outline" size={18} color={primaryButtonIconColor} />}
                  onPress={handleNavigateToUpload}
                />
              </View>
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
      iconColor,
      primaryButtonIconColor,
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
      className={containerClass}
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
            <ActivityIndicator size="small" color={iconColor} style={{ marginVertical: 20 }} />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={foldersLoading || filesLoading}
            onRefresh={handleRefresh}
            tintColor={iconColor}
          />
        }
        ListEmptyComponent={
          !foldersLoading && !filesLoading && allItems.length === 0 ? (
            <View className="items-center justify-center px-8 py-20">
              <View className="mb-6 h-24 w-24 items-center justify-center rounded-full border border-dashed border-gray-300 dark:border-white/15">
                <Ionicons name="folder-open-outline" size={36} color={iconColor} />
              </View>
              <Text className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
                {debouncedSearchQuery ? 'No matches' : 'This folder is calm'}
              </Text>
              <Text className="mb-8 max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
                {debouncedSearchQuery
                  ? 'No items found—try a different name.'
                  : 'Add a folder or upload files to fill this space.'}
              </Text>
              {!debouncedSearchQuery && (
                <View className="w-full max-w-sm flex-row justify-center" style={{ gap: 12 }}>
                  <Button
                    variant="secondary"
                    title="New Folder"
                    onPress={() => setIsCreateFolderModalVisible(true)}
                    leftIcon={<Ionicons name="add" size={18} color={iconColor} />}
                  />
                  <Button
                    title="Upload"
                    onPress={() => navigation.navigate('Upload', { folderId: currentFolderId })}
                    leftIcon={<Ionicons name="cloud-upload-outline" size={18} color={primaryButtonIconColor} />}
                  />
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
            <View className="w-[90%] max-w-md rounded-3xl border border-gray-200/70 bg-white/95 p-6 dark:border-white/10 dark:bg-white/5">
              <Text className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                {selectedItem.type === 'folder'
                  ? 'Folder'
                  : `File • ${formatFileSize(selectedItem.size_bytes ?? 0)}`}
              </Text>

              {selectedItem.type === 'file' && (
                <>
                  <Pressable
                    onPress={() => openPreview(selectedItem)}
                    className="mb-3 flex-row items-center rounded-xl border border-gray-200/70 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <Ionicons name="eye-outline" size={20} color={iconColor} />
                    <Text className="ml-3 text-base font-medium text-gray-800 dark:text-gray-200">
                      Preview
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => downloadFile(selectedItem)}
                    className="mb-3 flex-row items-center rounded-xl border border-gray-200/70 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <Ionicons name="download-outline" size={20} color={iconColor} />
                    <Text className="ml-3 text-base font-medium text-gray-800 dark:text-gray-200">
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
                className="mb-3 flex-row items-center rounded-xl border border-gray-200/70 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <Ionicons name="move-outline" size={20} color={iconColor} />
                <Text className="ml-3 text-base font-medium text-gray-800 dark:text-gray-200">
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
                        onPress: () => handleDelete(selectedItem),
                      },
                    ]
                  );
                }}
                className="flex-row items-center rounded-xl border border-rose-200/60 px-4 py-3 dark:border-rose-400/30 dark:bg-rose-950/20">
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
                <Text className="ml-3 text-base font-semibold text-rose-600 dark:text-rose-300">
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
          <Pressable className="w-[90%] max-w-md" onPress={() => {}}>
            <View className="rounded-3xl border border-gray-200/70 bg-white/95 p-6 dark:border-white/10 dark:bg-white/5">
              <Text className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Create a folder
              </Text>
              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Folder name"
                placeholderTextColor="#9ca3af"
                className="mb-5 w-full rounded-xl border border-gray-200/70 bg-white px-4 py-3 text-base text-gray-900 dark:border-white/10 dark:bg-white/10 dark:text-white"
                autoFocus
              />
              <View className="flex-row justify-end" style={{ gap: 12 }}>
                <Button
                  variant="secondary"
                  title="Cancel"
                  onPress={() => {
                    setIsCreateFolderModalVisible(false);
                    setNewFolderName('');
                  }}
                />
                <Button
                  onPress={createFolder}
                  disabled={createFolderMutation.isPending}
                  loading={createFolderMutation.isPending}
                  title="Create"
                />
              </View>
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
            <Pressable className="h-[60%] w-[90%] max-w-md" onPress={() => {}}>
              <View className="flex-1 rounded-3xl border border-gray-200/70 bg-white/95 dark:border-white/10 dark:bg-white/5">
                <View className="border-b border-gray-200/70 px-5 py-4 dark:border-white/10">
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white">Move to…</Text>
                </View>
                <FolderPicker
                  onSelectFolder={(destinationId) => {
                    handleMove(selectedItem, destinationId);
                  }}
                  currentFolderId={
                    selectedItem.type === 'folder' ? selectedItem.parent_id : selectedItem.folder_id
                  }
                  movingItemId={selectedItem.id}
                  itemType={selectedItem.type}
                />
              </View>
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
          className="absolute bottom-5 left-5 right-5 rounded-2xl border border-gray-200/70 bg-white/95 p-4 shadow-lg dark:border-white/10 dark:bg-white/10"
          style={{
            bottom: insets.bottom + 10,
            left: insets.left + 10,
            right: insets.right + 10,
          }}>
          {Object.values(downloadingFiles).map((download) => (
            <View key={download.name} className="mb-2">
              <Text className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                Downloading {download.name}…
              </Text>
              <View className="h-2 rounded-full bg-gray-200 dark:bg-white/20">
                <View
                  className="h-2 rounded-full bg-gray-900 dark:bg-white"
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
