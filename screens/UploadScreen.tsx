import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { formatFileSize } from '../types/database';

interface UploadScreenProps {
  navigation: any;
  route: {
    params: {
      folderId?: string;
    };
  };
}

interface FileToUpload {
  name: string;
  uri: string;
  type: string;
  size: number;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ navigation, route }) => {
  const { folderId } = route.params;
  const [files, setFiles] = useState<FileToUpload[]>([]);
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const containerClass = `flex-1 ${isDark ? 'bg-black' : 'bg-[#f7f8fb]'}`;
  const iconTint = isDark ? '#e5e7eb' : '#111827';

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      const newFiles = result.assets.map((asset) => ({
        name: asset.fileName || `image_${Date.now()}.jpg`,
        uri: asset.uri,
        type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        size: asset.fileSize || 0,
      }));
      setFiles([...files, ...newFiles]);
    }
  };

  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: '*/*', // Allow all file types
    });

    if (!result.canceled) {
      const newFiles = result.assets.map((asset) => ({
        name: asset.name,
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        size: asset.size || 0,
      }));
      setFiles([...files, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadMutation = useMutation({
    mutationFn: async (filesToUpload: FileToUpload[]) => {
      const results = [];

      for (const file of filesToUpload) {
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

        results.push({ fileName: file.name, fileId: recordData.fileRecord.id });
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['files', folderId] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });

      Alert.alert('Success', `${results.length} file(s) uploaded successfully!`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload files. Please try again.');
    },
  });

  const handleUpload = () => {
    if (files.length === 0) return;
    uploadMutation.mutate(files);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return 'image-outline';
    if (type.startsWith('video/')) return 'videocam-outline';
    if (type.startsWith('audio/')) return 'musical-notes-outline';
    if (type.includes('pdf')) return 'document-text-outline';
    return 'document-text-outline';
  };

  return (
    <View className={containerClass}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6 pt-8">
          <Text className="text-3xl font-semibold text-gray-900 dark:text-white">
            Choose files to upload
          </Text>

          <Text className="mt-3 text-base text-gray-500 dark:text-gray-400">
            Keep your uploads intentional—add only what you need.
          </Text>

          <View className="mt-8 gap-4">
            <Pressable
              onPress={pickImages}
              className="flex-row items-center rounded-2xl border border-gray-200/70 bg-white/90 px-5 py-4 active:scale-[0.99] dark:border-white/10 dark:bg-white/5">
              <View className="mr-4 h-14 w-14 items-center justify-center rounded-xl border border-gray-200/70 bg-white dark:border-white/10 dark:bg-transparent">
                <Ionicons name="image-outline" size={24} color={iconTint} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  Photos & videos
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Pick multiple images or clips at once.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Pressable>

            <Pressable
              onPress={pickDocuments}
              className="flex-row items-center rounded-2xl border border-gray-200/70 bg-white/90 px-5 py-4 active:scale-[0.99] dark:border-white/10 dark:bg-white/5">
              <View className="mr-4 h-14 w-14 items-center justify-center rounded-xl border border-gray-200/70 bg-white dark:border-white/10 dark:bg-transparent">
                <Ionicons name="document-text-outline" size={24} color={iconTint} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  Documents & files
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  All file types supported (up to 5GB)
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Pressable>
          </View>

          {/* Selected Files */}
          {files.length > 0 && (
            <View>
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-xl font-semibold text-gray-900 dark:text-white">
                  Selected Files
                </Text>
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </Text>
              </View>

              <View className="gap-3">
                {files.map((file, index) => {
                  const icon = getFileIcon(file.type);
                  return (
                    <View
                      key={index}
                      className="flex-row items-center rounded-2xl border border-gray-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl border border-gray-200/70 bg-white dark:border-white/10 dark:bg-transparent">
                        <Ionicons name={icon as any} size={20} color={iconTint} />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-base font-medium text-gray-900 dark:text-white"
                          numberOfLines={1}>
                          {file.name}
                        </Text>
                        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.size)} • {file.type.split('/')[0]}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => removeFile(index)}
                        className="ml-2 rounded-full border border-gray-200/70 p-2 active:bg-gray-100 dark:border-white/10 dark:active:bg-white/10">
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              {/* Upload Button */}
              <Button
                onPress={handleUpload}
                disabled={files.length === 0}
                loading={uploadMutation.isPending}
                title={
                  uploadMutation.isPending
                    ? 'Uploading...'
                    : `Upload ${files.length} file${files.length === 1 ? '' : 's'}`
                }
                leftIcon={
                  <Ionicons
                    name="cloud-upload-outline"
                    size={20}
                    color={isDark ? '#111827' : '#ffffff'}
                  />
                }
                className="mt-6"
                size="lg"
              />
            </View>
          )}

          {/* Upload Info */}
          {files.length === 0 && (
            <View className="mt-10 rounded-2xl border border-gray-200/70 bg-white/90 p-6 dark:border-white/10 dark:bg-white/5">
              <View className="items-center">
                <View className="mb-4 h-16 w-16 items-center justify-center rounded-full border border-dashed border-gray-300 dark:border-white/15">
                  <Ionicons name="cloud-upload-outline" size={28} color={iconTint} />
                </View>
                <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
                  Nothing queued yet
                </Text>
                <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Select files to stage them for upload.
                </Text>
              </View>
            </View>
          )}

          {/* Features Info */}
          <View className="mt-10 gap-3">
            <View className="flex-row items-start rounded-2xl border border-gray-200/70 bg-white/90 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <Ionicons name="information-circle-outline" size={18} color={iconTint} style={{ marginRight: 12 }} />
              <Text className="flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                Select multiple files in one go for fewer upload cycles.
              </Text>
            </View>

            <View className="flex-row items-start rounded-2xl border border-gray-200/70 bg-white/90 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <Ionicons name="shield-checkmark-outline" size={18} color={iconTint} style={{ marginRight: 12, marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Secure by default
                </Text>
                <Text className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Uploads are encrypted in transit and stored safely on AWS S3.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default UploadScreen;
