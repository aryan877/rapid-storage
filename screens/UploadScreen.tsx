import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
        // Get presigned URL from Edge Function
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
          'upload-to-s3',
          {
            body: {
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              folderId,
            },
          }
        );

        if (uploadError) throw uploadError;

        console.log('Upload data received:', uploadData);

        // Upload to S3 using presigned URL
        const formData = new FormData();

        // Add all presigned URL fields first
        Object.entries(uploadData.formData).forEach(([key, value]) => {
          formData.append(key, value as string);
        });

        // Important: file field must be last for S3 presigned uploads
        // React Native requires specific format for file objects
        formData.append('file', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        } as any);

        console.log('Uploading to S3:', {
          url: uploadData.uploadUrl,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });

        const uploadResponse = await fetch(uploadData.uploadUrl, {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header - let React Native handle it for FormData
        });

        console.log('S3 Upload response:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          ok: uploadResponse.ok,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('S3 Upload error response:', errorText);
          throw new Error(
            `Upload failed for ${file.name}: ${uploadResponse.status} ${uploadResponse.statusText}`
          );
        }

        results.push({ fileName: file.name, fileId: uploadData.fileId });
      }

      return results;
    },
    onSuccess: (results) => {
      // Invalidate and refetch file queries
      queryClient.invalidateQueries({ queryKey: ['files'] });
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
    if (type.startsWith('image/')) return { name: 'image', color: '#10b981' };
    if (type.startsWith('video/')) return { name: 'videocam', color: '#ef4444' };
    if (type.startsWith('audio/')) return { name: 'musical-notes', color: '#8b5cf6' };
    if (type.includes('pdf')) return { name: 'document', color: '#dc2626' };
    return { name: 'document-text', color: '#3b82f6' };
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <Pressable
          onPress={() => navigation.goBack()}
          className="rounded-lg p-2 active:bg-gray-100 dark:active:bg-gray-800">
          <Ionicons name="close" size={24} color="#6b7280" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">Upload Files</Text>
        <Pressable
          onPress={handleUpload}
          disabled={files.length === 0 || uploadMutation.isPending}
          className={`rounded-lg px-4 py-2 ${
            files.length === 0 || uploadMutation.isPending
              ? 'bg-gray-200 dark:bg-gray-700'
              : 'bg-blue-600 active:bg-blue-700'
          }`}>
          {uploadMutation.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text
              className={`font-semibold ${
                files.length === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-white'
              }`}>
              Upload {files.length > 0 && `(${files.length})`}
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="p-6">
          {/* Upload Options */}
          <Text className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
            Choose files to upload
          </Text>

          <View className="mb-8 gap-4">
            <Pressable
              onPress={pickImages}
              className="flex-row items-center rounded-2xl bg-white p-5 shadow-sm active:scale-[0.98] dark:bg-gray-900">
              <View className="mr-4 h-16 w-16 items-center justify-center rounded-xl bg-green-100 dark:bg-green-950/30">
                <Ionicons name="image" size={32} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  Photos & Videos
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Choose from your photo library
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </Pressable>

            <Pressable
              onPress={pickDocuments}
              className="flex-row items-center rounded-2xl bg-white p-5 shadow-sm active:scale-[0.98] dark:bg-gray-900">
              <View className="mr-4 h-16 w-16 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/30">
                <Ionicons name="document" size={32} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  Documents & Files
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  All file types supported (up to 5GB)
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
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
                      className="flex-row items-center rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                      <View
                        className={`mr-4 h-12 w-12 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800`}>
                        <Ionicons name={icon.name as any} size={24} color={icon.color} />
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
                        className="ml-2 rounded-lg p-2 active:bg-gray-100 dark:active:bg-gray-800">
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Upload Info */}
          {files.length === 0 && (
            <View className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900/50">
              <View className="items-center">
                <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <Ionicons name="cloud-upload-outline" size={40} color="#9ca3af" />
                </View>
                <Text className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">
                  No files selected
                </Text>
                <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Choose photos, videos, or documents to upload to your storage
                </Text>
              </View>
            </View>
          )}

          {/* Features Info */}
          <View className="mt-8 gap-3">
            <View className="flex-row items-center rounded-xl bg-blue-50 p-4 dark:bg-blue-950/20">
              <Ionicons
                name="information-circle"
                size={20}
                color="#3b82f6"
                style={{ marginRight: 12 }}
              />
              <Text className="flex-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                <Text className="font-semibold">Tip:</Text> You can select multiple files at once
                for faster uploads
              </Text>
            </View>

            <View className="flex-row items-start rounded-xl bg-green-50 p-4 dark:bg-green-950/20">
              <Ionicons
                name="shield-checkmark"
                size={20}
                color="#10b981"
                style={{ marginRight: 12, marginTop: 2 }}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Secure Upload
                </Text>
                <Text className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Your files are encrypted during upload and stored securely on AWS S3
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default UploadScreen;
