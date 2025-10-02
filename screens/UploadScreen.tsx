import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ShareIntent, ShareIntentFile, useShareIntent } from 'expo-share-intent';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Card from '../components/Card';
import {
  SAFE_LIMITS,
  isFileNameValid,
  isFileSizeValid,
  isFileTypeAllowed,
  isUploadSizeValid,
} from '../config/safeLimits';
import { supabase } from '../lib/supabase';
import { formatFileSize } from '../types/database';

const { width: screenWidth } = Dimensions.get('window');

interface UploadScreenProps {
  navigation: any;
  route: {
    params: {
      folderId?: string;
    };
  };
}

interface FileToUpload {
  id: string;
  name: string;
  uri: string;
  type: string;
  size: number;
  selected: boolean;
}

// Using safe limits from configuration
const MAX_FILES = SAFE_LIMITS.MAX_FILES_PER_UPLOAD;
const MAX_SELECTION_IMAGE_PICKER = SAFE_LIMITS.MAX_IMAGE_PICKER_SELECTION;
const MAX_TOTAL_SIZE = SAFE_LIMITS.MAX_TOTAL_SIZE_PER_UPLOAD;

const UploadScreen: React.FC<UploadScreenProps> = ({ navigation, route }) => {
  const { folderId } = route.params;
  const [files, setFiles] = useState<FileToUpload[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const queryClient = useQueryClient();
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();

  // Handle external sharing intents
  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      processSharedFiles(shareIntent);
    }
  }, [hasShareIntent, shareIntent]);

  useEffect(() => {
    if (error) {
      console.error('Share intent error:', error);
      Alert.alert('Error', 'Failed to process shared files. Please try again.');
    }
  }, [error]);

  const processSharedFiles = async (shareIntentData: ShareIntent) => {
    try {
      let sharedFiles: ShareIntentFile[] = [];

      // Handle different types of shared content
      if (shareIntentData.files && shareIntentData.files.length > 0) {
        sharedFiles = shareIntentData.files;
      } else if (shareIntentData.webUrl) {
        // Handle shared URLs - create a text file with the URL
        const urlFileName = `shared_url_${Date.now()}.txt`;
        const urlContent = shareIntentData.webUrl;
        const newFile: FileToUpload = {
          id: `shared_url_${Date.now()}`,
          name: urlFileName,
          uri: shareIntentData.webUrl,
          type: 'text/plain',
          size: new Blob([urlContent]).size,
          selected: false,
        };

        setFiles((prev) => {
          if (prev.length >= MAX_FILES) {
            Alert.alert('Upload queue full', 'Please clear some files before sharing more.');
            return prev;
          }
          return [...prev, newFile];
        });

        Alert.alert('URL added', 'The shared URL has been added to your upload queue.');
        resetShareIntent();
        return;
      } else if (shareIntentData.text) {
        // Handle shared text - create a text file
        const textFileName = `shared_text_${Date.now()}.txt`;
        const newFile: FileToUpload = {
          id: `shared_text_${Date.now()}`,
          name: textFileName,
          uri: `data:text/plain;base64,${btoa(shareIntentData.text)}`,
          type: 'text/plain',
          size: new Blob([shareIntentData.text]).size,
          selected: false,
        };

        setFiles((prev) => {
          if (prev.length >= MAX_FILES) {
            Alert.alert('Upload queue full', 'Please clear some files before sharing more.');
            return prev;
          }
          return [...prev, newFile];
        });

        Alert.alert('Text added', 'The shared text has been added to your upload queue.');
        resetShareIntent();
        return;
      }

      if (sharedFiles.length === 0) {
        resetShareIntent();
        return;
      }

      // Validate and filter files based on safe limits
      const validFiles: ShareIntentFile[] = [];
      const invalidFiles: string[] = [];

      for (const file of sharedFiles) {
        const fileName = file.fileName || file.path.split('/').pop() || `shared_file_${Date.now()}`;

        // Check file name validity
        if (!isFileNameValid(fileName)) {
          invalidFiles.push(`${fileName} (invalid name)`);
          continue;
        }

        // Check file size
        if (!isFileSizeValid(file.size || 0)) {
          invalidFiles.push(`${fileName} (file too large)`);
          continue;
        }

        // Check file type
        if (!isFileTypeAllowed(file.mimeType || '')) {
          invalidFiles.push(`${fileName} (unsupported file type)`);
          continue;
        }

        validFiles.push(file);
      }

      // Show invalid files warning if any
      if (invalidFiles.length > 0) {
        Alert.alert(
          'Some files were skipped',
          `${invalidFiles.length} file(s) were not added due to size, type, or name restrictions.`
        );
      }

      if (validFiles.length === 0) {
        Alert.alert(
          'No valid files',
          'None of the shared files could be added to the upload queue.'
        );
        resetShareIntent();
        return;
      }

      // Limit number of files
      const filesToAdd = validFiles.slice(0, Math.min(validFiles.length, MAX_FILES - files.length));

      if (filesToAdd.length < validFiles.length) {
        Alert.alert(
          'Queue limit reached',
          `Added ${filesToAdd.length} of ${validFiles.length} valid files. Clear the queue to add more.`
        );
      }

      const newFiles: FileToUpload[] = filesToAdd.map((file, index) => ({
        id: `shared_${Date.now()}_${index}`,
        name: file.fileName || file.path.split('/').pop() || `shared_file_${index}`,
        uri: file.path,
        type: file.mimeType,
        size: file.size || 0,
        selected: false,
      }));

      // Check total upload size
      const allFilesForUpload = [...files, ...newFiles];
      if (!isUploadSizeValid(allFilesForUpload)) {
        Alert.alert(
          'Size limit exceeded',
          `Total upload size exceeds ${formatFileSize(SAFE_LIMITS.MAX_TOTAL_SIZE_PER_UPLOAD)}. Please remove some files.`
        );
        resetShareIntent();
        return;
      }

      // Add to existing files
      setFiles((prev) => [...prev, ...newFiles]);

      // Show success message
      Alert.alert(
        'Files added from share',
        `${newFiles.length} file${newFiles.length === 1 ? '' : 's'} added to upload queue from external app`
      );

      // Clear the share intent to prevent reprocessing
      resetShareIntent();
    } catch (error) {
      console.error('Error processing shared files:', error);
      Alert.alert('Error', 'Failed to process shared files. Please try again.');
      resetShareIntent();
    }
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant library access to upload photos or videos.');
      return;
    }

    if (files.length >= MAX_FILES) {
      Alert.alert('Limit reached', `You can only select up to ${MAX_FILES} files at once.`);
      return;
    }

    const remainingSlots = MAX_FILES - files.length;
    const selectionLimit = Math.min(remainingSlots, MAX_SELECTION_IMAGE_PICKER);

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images', 'videos'],
      quality: 1,
      selectionLimit,
    });

    if (!result.canceled) {
      const validFiles: FileToUpload[] = [];
      const invalidFiles: string[] = [];

      for (const asset of result.assets) {
        const fileName = asset.fileName || asset.uri.split('/').pop() || `media_${Date.now()}`;
        const fileSize = asset.fileSize || 0;
        const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');

        // Validate file
        if (!isFileNameValid(fileName)) {
          invalidFiles.push(`${fileName} (invalid name)`);
          continue;
        }

        if (!isFileSizeValid(fileSize)) {
          invalidFiles.push(`${fileName} (file too large)`);
          continue;
        }

        if (!isFileTypeAllowed(mimeType)) {
          invalidFiles.push(`${fileName} (unsupported file type)`);
          continue;
        }

        validFiles.push({
          id: `media_${Date.now()}_${validFiles.length}`,
          name: fileName,
          uri: asset.uri,
          type: mimeType,
          size: fileSize,
          selected: false,
        });
      }

      // Show invalid files warning if any
      if (invalidFiles.length > 0) {
        Alert.alert(
          'Some files were skipped',
          `${invalidFiles.length} file(s) were not added due to size, type, or name restrictions.`
        );
      }

      if (validFiles.length === 0) {
        Alert.alert(
          'No valid files',
          'None of the selected files could be added to the upload queue.'
        );
        return;
      }

      // Check total upload size
      const allFilesForUpload = [...files, ...validFiles];
      if (!isUploadSizeValid(allFilesForUpload)) {
        Alert.alert(
          'Size limit exceeded',
          `Total upload size exceeds ${formatFileSize(SAFE_LIMITS.MAX_TOTAL_SIZE_PER_UPLOAD)}. Please remove some files.`
        );
        return;
      }

      // Add files to queue
      const totalFiles = files.length + validFiles.length;
      if (totalFiles > MAX_FILES) {
        Alert.alert(
          'Too many files',
          `You can only select up to ${MAX_FILES} files. ${validFiles.length - (MAX_FILES - files.length)} files were skipped.`
        );
        const trimmedFiles = validFiles.slice(0, MAX_FILES - files.length);
        setFiles((prev) => [...prev, ...trimmedFiles]);
      } else {
        setFiles((prev) => [...prev, ...validFiles]);
      }
    }
  };

  const pickFiles = async () => {
    if (files.length >= MAX_FILES) {
      Alert.alert('Limit reached', `You can only select up to ${MAX_FILES} files at once.`);
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: '*/*',
    });

    if (!result.canceled) {
      const validFiles: FileToUpload[] = [];
      const invalidFiles: string[] = [];

      for (const asset of result.assets) {
        // Validate file
        if (!isFileNameValid(asset.name)) {
          invalidFiles.push(`${asset.name} (invalid name)`);
          continue;
        }

        if (!isFileSizeValid(asset.size || 0)) {
          invalidFiles.push(`${asset.name} (file too large)`);
          continue;
        }

        if (!isFileTypeAllowed(asset.mimeType || '')) {
          invalidFiles.push(`${asset.name} (unsupported file type)`);
          continue;
        }

        validFiles.push({
          id: `doc_${Date.now()}_${validFiles.length}`,
          name: asset.name,
          uri: asset.uri,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
          selected: false,
        });
      }

      // Show invalid files warning if any
      if (invalidFiles.length > 0) {
        Alert.alert(
          'Some files were skipped',
          `${invalidFiles.length} file(s) were not added due to size, type, or name restrictions.`
        );
      }

      if (validFiles.length === 0) {
        Alert.alert(
          'No valid files',
          'None of the selected files could be added to the upload queue.'
        );
        return;
      }

      // Check total upload size
      const allFilesForUpload = [...files, ...validFiles];
      if (!isUploadSizeValid(allFilesForUpload)) {
        Alert.alert(
          'Size limit exceeded',
          `Total upload size exceeds ${formatFileSize(SAFE_LIMITS.MAX_TOTAL_SIZE_PER_UPLOAD)}. Please remove some files.`
        );
        return;
      }

      // Add files to queue
      const totalFiles = files.length + validFiles.length;
      if (totalFiles > MAX_FILES) {
        Alert.alert(
          'Too many files',
          `You can only select up to ${MAX_FILES} files. ${validFiles.length - (MAX_FILES - files.length)} files were skipped.`
        );
        const trimmedFiles = validFiles.slice(0, MAX_FILES - files.length);
        setFiles((prev) => [...prev, ...trimmedFiles]);
      } else {
        setFiles((prev) => [...prev, ...validFiles]);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    if (files.length === 1) {
      setSelectionMode(false);
    }
  };

  const toggleFileSelection = useCallback((fileId: string) => {
    setFiles((prev) =>
      prev.map((file) => (file.id === fileId ? { ...file, selected: !file.selected } : file))
    );
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(!selectionMode);
    if (!selectionMode) {
      // Clear all selections when entering selection mode
      setFiles((prev) => prev.map((file) => ({ ...file, selected: false })));
    }
  }, [selectionMode]);

  const selectAll = useCallback(() => {
    setFiles((prev) => prev.map((file) => ({ ...file, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setFiles((prev) => prev.map((file) => ({ ...file, selected: false })));
  }, []);

  const deleteSelected = useCallback(() => {
    const selectedCount = files.filter((f) => f.selected).length;
    if (selectedCount === 0) return;

    Alert.alert(
      'Delete Files',
      `Are you sure you want to remove ${selectedCount} selected file${selectedCount === 1 ? '' : 's'} from the upload queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setFiles((prev) => prev.filter((f) => !f.selected));
            setSelectionMode(false);
          },
        },
      ]
    );
  }, [files]);

  const uploadMutation = useMutation({
    mutationFn: async (filesToUpload: FileToUpload[]) => {
      const results = [];
      const totalSize = filesToUpload.reduce((acc, file) => acc + file.size, 0);

      if (totalSize > MAX_TOTAL_SIZE) {
        throw new Error(`Total file size exceeds ${formatFileSize(MAX_TOTAL_SIZE)} limit.`);
      }

      // Process files in batches to respect concurrent upload limit
      const batchSize = SAFE_LIMITS.MAX_CONCURRENT_UPLOADS;
      for (let i = 0; i < filesToUpload.length; i += batchSize) {
        const batch = filesToUpload.slice(i, i + batchSize);

        // Upload each file in the batch concurrently
        const batchPromises = batch.map(async (file) => {
          try {
            // Step 1: Get presigned URL from Edge Function
            const { data: presignedData, error: presignedError } = await supabase.functions.invoke(
              'upload-to-s3',
              {
                body: {
                  action: 'get-presigned-url',
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                },
              }
            );

            if (presignedError) throw presignedError;

            // Step 2: Upload to S3 using presigned URL
            const formData = new FormData();
            Object.entries(presignedData.formData).forEach(([key, value]) => {
              formData.append(key, value as string);
            });
            formData.append('file', {
              uri: file.uri,
              type: file.type,
              name: file.name,
            } as any);

            const uploadResponse = await fetch(presignedData.uploadUrl, {
              method: 'POST',
              body: formData,
            });

            if (!uploadResponse.ok) {
              throw new Error(`S3 upload failed for ${file.name}`);
            }

            // Step 3: Create file record in database
            const { data: recordData, error: recordError } = await supabase.functions.invoke(
              'upload-to-s3',
              {
                body: {
                  action: 'create-file-record',
                  s3Key: presignedData.s3Key,
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                  folderId,
                },
              }
            );

            if (recordError) throw recordError;

            return { fileName: file.name, fileId: recordData.fileRecord.id };
          } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            throw error;
          }
        });

        // Wait for all files in the batch to complete
        const batchResults = await Promise.allSettled(batchPromises);

        // Process results and handle any failures
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error('File upload failed:', result.reason);
            // Continue with other files even if one fails
          }
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['files', folderId] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });

      const failedCount = files.length - results.length;
      let message = `${results.length} file(s) uploaded successfully!`;
      if (failedCount > 0) {
        message = `${results.length} file(s) uploaded successfully. ${failedCount} file(s) failed to upload.`;
      }

      Alert.alert('Upload Complete', message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      Alert.alert(
        'Upload Error',
        `Failed to upload files: ${(error as Error).message}. Please try again.`
      );
    },
  });

  const handleUpload = () => {
    if (files.length === 0) return;
    uploadMutation.mutate(files);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return { icon: 'image', color: '#71717a' };
    if (type.startsWith('video/')) return { icon: 'videocam', color: '#71717a' };
    if (type.startsWith('audio/')) return { icon: 'musical-notes', color: '#71717a' };
    if (type.includes('pdf')) return { icon: 'document', color: '#71717a' };
    if (type.includes('text')) return { icon: 'document-text', color: '#71717a' };
    return { icon: 'document-text', color: '#71717a' };
  };

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);
  const selectedFiles = files.filter((f) => f.selected);
  const selectedCount = selectedFiles.length;
  const allSelected = files.length > 0 && selectedCount === files.length;

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: screenWidth > 768 ? 64 : 24,
          paddingVertical: 32,
          paddingBottom: 100,
        }}>
        {/* Header */}
        <View className="mb-8">
          <Text className="mb-4 text-4xl font-bold text-zinc-100">Upload Files</Text>
          <Text className="text-lg leading-relaxed text-zinc-400">
            Add photos, documents, and any files up to {formatFileSize(SAFE_LIMITS.MAX_FILE_SIZE)}{' '}
            each.
          </Text>
        </View>

        {/* Upload Actions */}
        <View className={`mb-8 ${screenWidth > 768 ? 'flex-row gap-6' : 'gap-4'}`}>
          <Card variant="elevated" padding="lg" className={`${screenWidth > 768 ? 'flex-1' : ''}`}>
            <Pressable onPress={pickMedia} className="items-center">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-zinc-800">
                <Ionicons name="images" size={28} color="#71717a" />
              </View>
              <Text className="mb-2 text-center text-xl font-bold text-zinc-100">
                Photos & Videos
              </Text>
              <Text className="text-center text-sm text-zinc-500">
                Choose up to {MAX_SELECTION_IMAGE_PICKER} media files from your library.
              </Text>
            </Pressable>
          </Card>

          <Card variant="elevated" padding="lg" className={`${screenWidth > 768 ? 'flex-1' : ''}`}>
            <Pressable onPress={pickFiles} className="items-center">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-zinc-800">
                <Ionicons name="cloud-upload-outline" size={32} color="#71717a" />
              </View>
              <Text className="mb-2 text-center text-xl font-bold text-zinc-100">Browse Files</Text>
              <Text className="text-center text-sm text-zinc-500">
                Pick any documents or other files to add to your upload queue.
              </Text>
            </Pressable>
          </Card>
        </View>

        {/* External Sharing Info */}
        {files.length === 0 && (
          <Card variant="glass" padding="md" className="mb-6">
            <View className="flex-row items-start">
              <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                <Ionicons name="share-outline" size={18} color="#71717a" />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-base font-semibold text-zinc-100">
                  Share from other apps
                </Text>
                <Text className="text-sm text-zinc-400">
                  Use &ldquo;Share&rdquo; from Photos, Files, Safari, or any app and select Rapid
                  Storage to upload directly
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Selected Files */}
        {files.length > 0 && (
          <Card variant="default" padding="lg" className="mb-8">
            <View className="mb-6 flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-zinc-100">Selected Files</Text>
                <Text className="mt-1 text-sm text-zinc-500">
                  {files.length} files • {formatFileSize(totalSize)} total
                  {files.length >= MAX_FILES && (
                    <Text className="text-amber-500"> • Max limit reached</Text>
                  )}
                </Text>
              </View>
              <View className="flex-row gap-2">
                {files.length > 1 && (
                  <Button
                    variant={selectionMode ? 'secondary' : 'outline'}
                    size="sm"
                    title={selectionMode ? 'Done' : 'Select'}
                    onPress={toggleSelectionMode}
                    leftIcon={
                      <Ionicons
                        name={selectionMode ? 'checkmark' : 'checkmark-circle-outline'}
                        size={16}
                        color={selectionMode ? '#09090b' : '#71717a'}
                      />
                    }
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  title="Clear All"
                  onPress={() => setFiles([])}
                />
              </View>
            </View>

            {/* Bulk Actions */}
            {selectionMode && (
              <View className="mb-4 flex-row items-center justify-between rounded-xl bg-zinc-800 p-3">
                <View className="flex-row items-center gap-3">
                  <Text className="text-sm font-medium text-zinc-300">
                    {selectedCount} of {files.length} selected
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  {!allSelected && (
                    <Button variant="ghost" size="sm" title="Select All" onPress={selectAll} />
                  )}
                  {selectedCount > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Deselect All"
                        onPress={deselectAll}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete Selected"
                        onPress={deleteSelected}
                        leftIcon={<Ionicons name="trash-outline" size={16} color="#d4d4d8" />}
                      />
                    </>
                  )}
                </View>
              </View>
            )}

            <View className="mb-6 gap-3">
              {files.map((file, index) => {
                const fileIcon = getFileIcon(file.type);
                return (
                  <Pressable
                    key={file.id}
                    className={`flex-row items-center rounded-2xl p-4 ${
                      selectionMode && file.selected
                        ? 'border border-blue-500 bg-blue-900/30'
                        : 'bg-zinc-900'
                    }`}
                    onPress={() => (selectionMode ? toggleFileSelection(file.id) : null)}>
                    {selectionMode && (
                      <View className="mr-3">
                        <Ionicons
                          name={file.selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={file.selected ? '#3b82f6' : '#71717a'}
                        />
                      </View>
                    )}
                    <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
                      <Ionicons name={fileIcon.icon as any} size={24} color={fileIcon.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-zinc-100" numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text className="mt-1 text-sm text-zinc-500">
                        {formatFileSize(file.size)} • {file.type.split('/')[0]}
                      </Text>
                    </View>
                    {!selectionMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title=""
                        onPress={() => removeFile(index)}
                        leftIcon={<Ionicons name="trash-outline" size={18} color="#d4d4d8" />}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Button
              onPress={handleUpload}
              disabled={files.length === 0 || uploadMutation.isPending || selectionMode}
              loading={uploadMutation.isPending}
              variant="primary"
              size="lg"
              title={
                selectionMode
                  ? 'Exit selection mode to upload'
                  : uploadMutation.isPending
                    ? 'Uploading files...'
                    : `Upload ${files.length} file${files.length === 1 ? '' : 's'}`
              }
              leftIcon={
                <Ionicons
                  name="cloud-upload"
                  size={20}
                  color={selectionMode ? '#71717a' : '#09090b'}
                />
              }
              className="w-full"
            />
          </Card>
        )}

        {/* Empty State */}
        {files.length === 0 && (
          <Card variant="glass" padding="lg" className="mb-8">
            <View className="items-center py-8">
              <View className="mb-6 h-24 w-24 items-center justify-center rounded-3xl bg-zinc-900">
                <Ionicons name="cloud-upload-outline" size={36} color="#71717a" />
              </View>
              <Text className="mb-3 text-center text-2xl font-bold text-zinc-100">
                Ready to Upload
              </Text>
              <Text className="max-w-sm text-center text-base leading-relaxed text-zinc-500">
                Select up to {MAX_FILES} files to upload. Maximum file size is{' '}
                {formatFileSize(SAFE_LIMITS.MAX_FILE_SIZE)}.
              </Text>
            </View>
          </Card>
        )}

        {/* Features */}
        <View className="gap-4">
          <Card variant="outlined" padding="md">
            <View className="flex-row items-start">
              <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                <Ionicons name="flash" size={18} color="#71717a" />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-base font-semibold text-zinc-100">Lightning Fast</Text>
                <Text className="text-sm text-zinc-400">
                  Optimized uploads with progress tracking and error recovery
                </Text>
              </View>
            </View>
          </Card>

          <Card variant="outlined" padding="md">
            <View className="flex-row items-start">
              <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                <Ionicons name="layers" size={18} color="#71717a" />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-base font-semibold text-zinc-100">Bulk Operations</Text>
                <Text className="text-sm text-zinc-400">
                  Select up to {MAX_FILES} files at once with smart selection tools
                </Text>
              </View>
            </View>
          </Card>

          <Card variant="outlined" padding="md">
            <View className="flex-row items-start">
              <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                <Ionicons name="shield-checkmark" size={18} color="#71717a" />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-base font-semibold text-zinc-100">
                  Enterprise Security
                </Text>
                <Text className="text-sm text-zinc-400">
                  End-to-end encryption with secure AWS S3 cloud storage
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default UploadScreen;
