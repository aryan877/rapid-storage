import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { File } from '../types/database';

const PAGE_SIZE = 20;

export const useFilesQuery = (
  userId: string | undefined,
  currentFolderId: string | null,
  searchQuery?: string
) => {
  return useInfiniteQuery({
    queryKey: ['files', currentFolderId, searchQuery],
    queryFn: async ({ pageParam }: { pageParam?: { created_at: string; id: string } }) => {
      let query = supabase
        .from('files')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
        // When searching, don't filter by folder_id to search globally across all files
      } else {
        // Only apply folder_id filter when not searching
        if (currentFolderId === null) {
          query = query.is('folder_id', null);
        } else {
          query = query.eq('folder_id', currentFolderId);
        }
      }

      if (pageParam?.created_at) {
        query = query.lt('created_at', pageParam.created_at);
      }

      const { data, error } = await query.limit(PAGE_SIZE);

      if (error) throw error;
      return { data: data as File[] };
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.data || lastPage.data.length < PAGE_SIZE) {
        return undefined;
      }
      const lastItem = lastPage.data[lastPage.data.length - 1];
      if (lastItem?.created_at) {
        return {
          created_at: lastItem.created_at,
          id: lastItem.id,
        };
      }
      return undefined;
    },
    enabled: !!userId,
  });
};

export const useDeleteFileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, s3Key }: { fileId: string; s3Key: string }) => {
      // First, delete the record from the database
      const { error: dbError } = await supabase.from('files').delete().eq('id', fileId);
      if (dbError) throw dbError;

      // Then, delete the file from S3 via the Edge Function
      const { error: s3Error } = await supabase.functions.invoke('upload-to-s3', {
        body: {
          action: 'delete-file',
          s3Key: s3Key,
        },
      });
      if (s3Error) {
        console.error('S3 deletion failed, but DB record was deleted:', s3Error);
        throw new Error(`S3 deletion failed: ${s3Error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    },
  });
};

export const useMoveFileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      destinationFolderId,
    }: {
      fileId: string;
      destinationFolderId: string | null;
    }) => {
      const { error } = await supabase
        .from('files')
        .update({ folder_id: destinationFolderId })
        .eq('id', fileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    },
  });
};