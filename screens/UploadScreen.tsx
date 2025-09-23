import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Card from '../components/Card';
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
  name: string;
  uri: string;
  type: string;
  size: number;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ navigation, route }) => {
  const { folderId } = route.params;
  const [files, setFiles] = useState<FileToUpload[]>([]);
  const queryClient = useQueryClient();

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant library access to upload photos or videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 1,
    });

    if (!result.canceled) {
      const newFiles = result.assets.map((asset) => ({
        name: asset.fileName || asset.uri.split('/').pop() || `media_${Date.now()}`,
        uri: asset.uri,
        type:
          asset.type === 'video'
            ? 'video/mp4'
            : asset.mimeType ||
              (asset.type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        size: asset.fileSize || 0,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const pickFiles = async () => {
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
      setFiles((prev) => [...prev, ...newFiles]);
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
    if (type.startsWith('image/')) return { icon: 'image', color: '#71717a' };
    if (type.startsWith('video/')) return { icon: 'videocam', color: '#71717a' };
    if (type.startsWith('audio/')) return { icon: 'musical-notes', color: '#71717a' };
    if (type.includes('pdf')) return { icon: 'document', color: '#71717a' };
    if (type.includes('text')) return { icon: 'document-text', color: '#71717a' };
    return { icon: 'document-text', color: '#71717a' };
  };

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);

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
            Add photos, documents, and any files up to 5GB each.
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
                Choose media from your library to upload instantly.
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

        {/* Selected Files */}
        {files.length > 0 && (
          <Card variant="default" padding="lg" className="mb-8">
            <View className="mb-6 flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-zinc-100">Selected Files</Text>
                <Text className="mt-1 text-sm text-zinc-500">
                  {files.length} files • {formatFileSize(totalSize)} total
                </Text>
              </View>
              <Button variant="outline" size="sm" title="Clear All" onPress={() => setFiles([])} />
            </View>

            <View className="mb-6 gap-3">
              {files.map((file, index) => {
                const fileIcon = getFileIcon(file.type);
                return (
                  <View key={index} className="flex-row items-center rounded-2xl bg-zinc-900 p-4">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      title=""
                      onPress={() => removeFile(index)}
                      leftIcon={<Ionicons name="trash-outline" size={18} color="#d4d4d8" />}
                    />
                  </View>
                );
              })}
            </View>

            <Button
              onPress={handleUpload}
              disabled={files.length === 0 || uploadMutation.isPending}
              loading={uploadMutation.isPending}
              variant="primary"
              size="lg"
              title={
                uploadMutation.isPending
                  ? 'Uploading files...'
                  : `Upload ${files.length} file${files.length === 1 ? '' : 's'}`
              }
              leftIcon={<Ionicons name="cloud-upload" size={20} color="#09090b" />}
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
                Choose photos and videos or browse documents to get started
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
