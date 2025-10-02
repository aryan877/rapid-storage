import { Ionicons } from '@expo/vector-icons';
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
import Button from '../components/Button';
import Card from '../components/Card';
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
import { SAFE_LIMITS } from '../config/safeLimits';

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

  const colorMap: Record<FileIconType, string> = {
    document: '#71717a',
    image: '#71717a',
    video: '#71717a',
    audio: '#71717a',
    archive: '#71717a',
    code: '#71717a',
    pdf: '#71717a',
    spreadsheet: '#71717a',
    presentation: '#71717a',
    text: '#71717a',
    unknown: '#71717a',
  };

  return <Ionicons name={glyphMap[type] as any} size={size} color={colorMap[type]} />;
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
    <View className="mb-6">
      <View className="flex-row items-center rounded-2xl bg-zinc-900 px-4 py-3">
        <Ionicons name="search" size={20} color="#71717a" />
        <TextInput
          placeholder="Search files and folders..."
          value={searchQuery}
          onChangeText={onSearchChange}
          className="ml-3 flex-1 text-base text-zinc-100"
          placeholderTextColor="#71717a"
        />
        {searchQuery.length > 0 && (
          <Ionicons
            name="close-circle"
            size={20}
            color="#71717a"
            onPress={() => onSearchChange('')}
          />
        )}
      </View>
    </View>
  )
);

const FileManagerScreen: React.FC<FileManagerScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const iconColor = '#a1a1aa';
  const insets = useSafeAreaInsets();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [isCreateFolderModalVisible, setIsCreateFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<
    Record<string, { progress: number; name: string }>
  >({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const openActionSheet = useCallback((item: any) => {
    setSelectedItem(item);
    setIsActionSheetVisible(true);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(!selectionMode);
    setSelectedItems(new Set());
  }, [selectionMode]);

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const deselectAllItems = useCallback(() => {
    setSelectedItems(new Set());
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

  const handleDelete = async (item: any) => {
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

  const handleMove = async (item: any, destinationFolderId: string | null) => {
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

  const downloadFile = async (file: any) => {
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
      Alert.alert(
        'Download Error',
        `Failed to download file: ${(error as Error).message}. Please try again.`
      );
    } finally {
      setDownloadingFiles((prev) => {
        const newDownloads = { ...prev };
        delete newDownloads[file.id];
        return newDownloads;
      });
    }
  };

  const openPreview = useCallback(async (file: any) => {
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

  const renderBreadcrumb = useCallback(
    () => (
      <View className="px-6 pb-2 pt-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-3xl font-bold text-zinc-100">
            {folderPath[folderPath.length - 1]?.name || 'My Drive'}
          </Text>
          {folderPath.length > 1 && (
            <Button
              onPress={handleGoBack}
              variant="outline"
              size="sm"
              title="Back"
              leftIcon={<Ionicons name="chevron-back" size={16} color={iconColor} />}
            />
          )}
        </View>
        {folderPath.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-2"
            contentContainerStyle={{ alignItems: 'center' }}>
            {folderPath.map((path, index) => (
              <View key={path.id ?? index} className="flex-row items-center">
                {index > 0 && (
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color="#71717a"
                    style={{ marginHorizontal: 8 }}
                  />
                )}
                <Pressable onPress={() => navigateToPath(index)}>
                  <Text
                    className={`rounded-lg px-2 py-1 text-sm ${
                      index === folderPath.length - 1
                        ? 'bg-zinc-900 font-semibold text-zinc-100'
                        : 'text-zinc-500'
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
    [folderPath, navigateToPath, handleGoBack, iconColor]
  );

  const renderFolder = useCallback(
    ({ item }: { item: Folder }) => (
      <View className="mx-4 mb-3">
        <Pressable
          onPress={() => (selectionMode ? toggleItemSelection(item.id) : navigateToFolder(item))}
          className={`flex-row items-center rounded-2xl border p-4 active:bg-zinc-800 ${
            selectionMode && selectedItems.has(item.id)
              ? 'border-blue-500 bg-blue-900/30'
              : 'border-zinc-800 bg-zinc-900'
          }`}>
          {selectionMode && (
            <View className="mr-3">
              <Ionicons
                name={selectedItems.has(item.id) ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={selectedItems.has(item.id) ? '#3b82f6' : '#71717a'}
              />
            </View>
          )}
          <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800">
            <Ionicons name="folder" size={24} color="#71717a" />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-lg font-semibold text-zinc-100">{item.name}</Text>
            <Text className="text-sm text-zinc-500">
              Created {new Date(item.created_at!).toLocaleDateString()}
            </Text>
          </View>
          {!selectionMode && (
            <Pressable
              className="ml-2 h-10 w-10 items-center justify-center rounded-xl bg-zinc-900"
              onPress={() => openActionSheet({ ...item, type: 'folder' })}>
              <Ionicons name="ellipsis-horizontal" size={18} color={iconColor} />
            </Pressable>
          )}
        </Pressable>
      </View>
    ),
    [
      navigateToFolder,
      iconColor,
      openActionSheet,
      selectionMode,
      selectedItems,
      toggleItemSelection,
    ]
  );

  const renderFile = useCallback(
    ({ item }: { item: File }) => (
      <View className="mx-4 mb-3">
        <Pressable
          onPress={() =>
            selectionMode ? toggleItemSelection(item.id) : openPreview({ ...item, type: 'file' })
          }
          className={`flex-row items-center rounded-2xl border p-4 active:bg-zinc-800 ${
            selectionMode && selectedItems.has(item.id)
              ? 'border-blue-500 bg-blue-900/30'
              : 'border-zinc-800 bg-zinc-900'
          }`}>
          {selectionMode && (
            <View className="mr-3">
              <Ionicons
                name={selectedItems.has(item.id) ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={selectedItems.has(item.id) ? '#3b82f6' : '#71717a'}
              />
            </View>
          )}
          <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900">
            <FileIcon type={getFileIcon(item.mime_type || undefined)} size={24} />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-lg font-semibold text-zinc-100" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-sm text-zinc-500">
              {formatFileSize(item.size_bytes)} • {new Date(item.created_at!).toLocaleDateString()}
            </Text>
          </View>
          {!selectionMode && (
            <Pressable
              className="ml-2 h-10 w-10 items-center justify-center rounded-xl bg-zinc-900"
              onPress={() => openActionSheet({ ...item, type: 'file' })}>
              <Ionicons name="ellipsis-horizontal" size={18} color={iconColor} />
            </Pressable>
          )}
        </Pressable>
      </View>
    ),
    [openPreview, iconColor, openActionSheet, selectionMode, selectedItems, toggleItemSelection]
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

  const selectedCount = selectedItems.size;
  const allSelected = allItems.length > 0 && selectedCount === allItems.length;

  const selectAllItems = useCallback(() => {
    const allItemIds = new Set(allItems.map((item) => item.id));
    setSelectedItems(allItemIds);
  }, [allItems]);

  const bulkDelete = useCallback(async () => {
    if (selectedItems.size === 0) return;

    const itemsToDelete = allItems.filter((item) => selectedItems.has(item.id));
    const fileCount = itemsToDelete.filter((item) => item.type === 'file').length;
    const folderCount = itemsToDelete.filter((item) => item.type === 'folder').length;

    let message = `Are you sure you want to delete ${selectedItems.size} item${selectedItems.size === 1 ? '' : 's'}?`;
    if (fileCount > 0 && folderCount > 0) {
      message = `Are you sure you want to delete ${fileCount} file${fileCount === 1 ? '' : 's'} and ${folderCount} folder${folderCount === 1 ? '' : 's'}?`;
    } else if (fileCount > 0) {
      message = `Are you sure you want to delete ${fileCount} file${fileCount === 1 ? '' : 's'}?`;
    } else if (folderCount > 0) {
      message = `Are you sure you want to delete ${folderCount} folder${folderCount === 1 ? '' : 's'}?`;
    }

    Alert.alert('Delete Items', message + ' This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            for (const item of itemsToDelete) {
              if (item.type === 'folder') {
                await deleteFolderMutation.mutateAsync(item.id);
              } else {
                await deleteFileMutation.mutateAsync({
                  fileId: item.id,
                  s3Key: item.s3_key!,
                });
              }
            }
            setSelectionMode(false);
            setSelectedItems(new Set());
            Alert.alert(
              'Success',
              `${selectedItems.size} item${selectedItems.size === 1 ? '' : 's'} deleted.`
            );
          } catch (error) {
            Alert.alert('Error', `Failed to delete some items. ${(error as Error).message}`);
          }
        },
      },
    ]);
  }, [selectedItems, allItems, deleteFolderMutation, deleteFileMutation]);

  // Memoize the header component to prevent unnecessary re-renders
  const renderHeader = useMemo(
    () => (
      <>
        {renderBreadcrumb()}
        <View className="mb-4 px-6">
          <SearchInput searchQuery={searchQuery} onSearchChange={handleSearchChange} />

          <View className="mb-6 flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-semibold text-zinc-100">
                {folders.length + files.length}{' '}
                {folders.length + files.length === 1 ? 'item' : 'items'}
              </Text>
              <Text className="text-sm text-zinc-500">
                {folders.length} folders • {files.length} files
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              {allItems.length > 0 && (
                <Button
                  variant={selectionMode ? 'secondary' : 'outline'}
                  size="sm"
                  title={selectionMode ? 'Done' : 'Select'}
                  leftIcon={
                    <Ionicons
                      name={selectionMode ? 'checkmark' : 'checkmark-circle-outline'}
                      size={16}
                      color={selectionMode ? '#09090b' : iconColor}
                    />
                  }
                  onPress={toggleSelectionMode}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                title="New Folder"
                leftIcon={<Ionicons name="folder-open-outline" size={16} color={iconColor} />}
                onPress={() => setIsCreateFolderModalVisible(true)}
              />
              <Button
                variant="secondary"
                size="sm"
                title="Upload"
                leftIcon={<Ionicons name="cloud-upload-outline" size={16} color="#71717a" />}
                onPress={handleNavigateToUpload}
              />
            </View>
          </View>

          {/* Bulk Actions Bar */}
          {selectionMode && (
            <View className="mx-4 mb-4 flex-row items-center justify-between rounded-xl bg-zinc-800 p-3">
              <View className="flex-row items-center gap-3">
                <Text className="text-sm font-medium text-zinc-300">
                  {selectedCount} of {allItems.length} selected
                </Text>
              </View>
              <View className="flex-row gap-2">
                {!allSelected && selectedCount < 50 && (
                  <Button variant="ghost" size="sm" title="Select All" onPress={selectAllItems} />
                )}
                {selectedCount > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Deselect All"
                      onPress={deselectAllItems}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete Selected"
                      onPress={bulkDelete}
                      leftIcon={<Ionicons name="trash-outline" size={16} color="#d4d4d8" />}
                    />
                  </>
                )}
              </View>
            </View>
          )}
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
      allItems,
      selectedCount,
      allSelected,
      selectAllItems,
      bulkDelete,
      selectionMode,
      toggleSelectionMode,
      deselectAllItems,
    ]
  );

  return (
    <View
      className="flex-1 bg-zinc-950"
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
        contentContainerStyle={{ paddingBottom: 20 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextFolders || isFetchingNextFiles ? (
            <View className="items-center py-8">
              <ActivityIndicator size="small" color="#71717a" />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={foldersLoading || filesLoading}
            onRefresh={handleRefresh}
            tintColor="#71717a"
          />
        }
        ListEmptyComponent={
          !foldersLoading && !filesLoading && allItems.length === 0 ? (
            <View className="items-center justify-center px-8 py-16">
              <View className="mb-8 h-32 w-32 items-center justify-center rounded-3xl bg-zinc-900">
                <Ionicons
                  name={debouncedSearchQuery ? 'search-outline' : 'folder-open-outline'}
                  size={48}
                  color="#71717a"
                />
              </View>
              <Text className="mb-3 text-center text-2xl font-bold text-zinc-100">
                {debouncedSearchQuery ? 'No results found' : 'Empty folder'}
              </Text>
              <Text className="mb-12 max-w-sm text-center text-base leading-relaxed text-zinc-500">
                {debouncedSearchQuery
                  ? 'Try adjusting your search terms or browse your folders.'
                  : 'This folder is waiting for your first upload or subfolder.'}
              </Text>
              {!debouncedSearchQuery && (
                <View className="w-full max-w-sm gap-3">
                  <Button
                    variant="secondary"
                    size="lg"
                    title="Upload Files"
                    onPress={() => navigation.navigate('Upload', { folderId: currentFolderId })}
                    leftIcon={<Ionicons name="cloud-upload-outline" size={20} color="#71717a" />}
                    className="w-full"
                  />
                  <Button
                    variant="outline"
                    size="lg"
                    title="Create Folder"
                    onPress={() => setIsCreateFolderModalVisible(true)}
                    leftIcon={<Ionicons name="folder-open-outline" size={20} color={iconColor} />}
                    className="w-full"
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
            className="flex-1 justify-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setIsActionSheetVisible(false)}>
            <View className="rounded-t-3xl border-t border-zinc-800 bg-zinc-950 p-6">
              <View className="mb-6 items-center">
                <View className="mb-4 h-1 w-12 rounded-full bg-zinc-700" />
                <Text className="text-xl font-bold text-zinc-100">{selectedItem.name}</Text>
                <Text className="mt-1 text-sm text-zinc-500">
                  {selectedItem.type === 'folder'
                    ? 'Folder'
                    : `${formatFileSize(selectedItem.size_bytes ?? 0)} file`}
                </Text>
              </View>

              <View className="gap-2">
                {selectedItem.type === 'file' && (
                  <>
                    <Button
                      onPress={() => openPreview(selectedItem)}
                      variant="ghost"
                      size="lg"
                      title="Preview"
                      leftIcon={<Ionicons name="eye-outline" size={20} color="#71717a" />}
                      className="justify-start"
                    />

                    <Button
                      onPress={() => downloadFile(selectedItem)}
                      variant="ghost"
                      size="lg"
                      title="Download"
                      leftIcon={<Ionicons name="download-outline" size={20} color="#a1a1aa" />}
                      className="justify-start"
                    />
                  </>
                )}

                <Button
                  onPress={() => {
                    setIsActionSheetVisible(false);
                    setIsMoveModalVisible(true);
                  }}
                  variant="ghost"
                  size="lg"
                  title={`Move ${selectedItem.type}`}
                  leftIcon={<Ionicons name="move-outline" size={20} color="#a1a1aa" />}
                  className="justify-start"
                />

                <Button
                  onPress={() => {
                    Alert.alert(
                      `Delete ${selectedItem.type}`,
                      `Are you sure you want to delete "${selectedItem.name}"? This action cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => handleDelete(selectedItem),
                        },
                      ]
                    );
                  }}
                  variant="ghost"
                  size="lg"
                  title={`Delete ${selectedItem.type}`}
                  leftIcon={<Ionicons name="trash-outline" size={20} color="#a1a1aa" />}
                  className="justify-start"
                />
              </View>

              <Button
                onPress={() => setIsActionSheetVisible(false)}
                variant="outline"
                size="lg"
                title="Cancel"
                className="mt-6"
              />
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
            <Card variant="elevated" padding="lg">
              <View className="mb-6 items-center">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10">
                  <Ionicons name="folder-open-outline" size={28} color="#71717a" />
                </View>
                <Text className="text-2xl font-bold text-zinc-100">Create Folder</Text>
                <Text className="mt-1 text-sm text-zinc-500">Give your new folder a name</Text>
              </View>

              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Enter folder name..."
                placeholderTextColor="#71717a"
                className="mb-6 w-full rounded-2xl bg-zinc-900 px-4 py-4 text-lg text-zinc-100"
                autoFocus
              />

              <View className="gap-3">
                <Button
                  onPress={handleCreateFolder}
                  disabled={createFolderMutation.isPending || !newFolderName.trim()}
                  loading={createFolderMutation.isPending}
                  variant="primary"
                  size="lg"
                  title="Create Folder"
                  className="w-full"
                />
                <Button
                  variant="outline"
                  size="lg"
                  title="Cancel"
                  onPress={() => {
                    setIsCreateFolderModalVisible(false);
                    setNewFolderName('');
                  }}
                  className="w-full"
                />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
      {selectedItem && (
        <Modal visible={isMoveModalVisible} transparent animationType="slide">
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onPress={() => setIsMoveModalVisible(false)}>
            <Pressable className="h-[70%] w-[90%] max-w-md" onPress={() => {}}>
              <Card variant="elevated" padding="none" className="flex-1">
                <View className="border-b border-zinc-800 px-6 py-4">
                  <Text className="text-xl font-bold text-zinc-100">Move Item</Text>
                  <Text className="mt-1 text-sm text-zinc-500">
                    Choose a destination for &quot;{selectedItem.name}&quot;
                  </Text>
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
              </Card>
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
              className="absolute right-5 top-10 rounded-full bg-zinc-900/80 p-2">
              <Ionicons name="close" size={32} color="#f4f4f5" />
            </Pressable>
          </SafeAreaView>
        </Modal>
      )}
      {Object.values(downloadingFiles).length > 0 && (
        <View
          className="absolute bottom-5 left-5 right-5 rounded-2xl border border-zinc-800 bg-zinc-900/95 p-4 shadow-lg"
          style={{
            bottom: insets.bottom + 10,
            left: insets.left + 10,
            right: insets.right + 10,
          }}>
          <Text className="mb-3 text-sm font-medium text-zinc-100">
            Downloading {Object.values(downloadingFiles).length} file
            {Object.values(downloadingFiles).length === 1 ? '' : 's'}…
          </Text>
          {Object.values(downloadingFiles).map((download) => (
            <View key={download.name} className="mb-3">
              <Text className="mb-1 text-xs text-zinc-400">{download.name}</Text>
              <View className="h-2 rounded-full bg-zinc-800">
                <View
                  className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${download.progress * 100}%` }}
                />
              </View>
              <Text className="mt-1 text-xs text-zinc-500">
                {Math.round(download.progress * 100)}% complete
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default FileManagerScreen;
