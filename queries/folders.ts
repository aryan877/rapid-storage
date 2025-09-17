import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Folder } from '../types/database';

const PAGE_SIZE = 20;

export const useFoldersQuery = (
  userId: string | undefined,
  currentFolderId: string | null,
  searchQuery?: string
) => {
  return useInfiniteQuery({
    queryKey: ['folders', currentFolderId, searchQuery],
    queryFn: async ({ pageParam }: { pageParam?: { created_at: string; id: string } }) => {
      let query = supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
        // When searching, don't filter by parent_id to search globally across all folders
      } else {
        // Only apply parent_id filter when not searching
        if (currentFolderId === null) {
          query = query.is('parent_id', null);
        } else {
          query = query.eq('parent_id', currentFolderId);
        }
      }

      if (pageParam?.created_at) {
        query = query.lt('created_at', pageParam.created_at);
      }

      const { data, error } = await query.limit(PAGE_SIZE);

      if (error) throw error;
      return { data: data as Folder[] };
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

export const usePickerFoldersQuery = (
  userId: string | undefined,
  activeFolderId: string | null
) => {
  return useInfiniteQuery({
    queryKey: ['picker-folders', activeFolderId],
    queryFn: async ({ pageParam }: { pageParam?: { created_at: string; id: string } }) => {
      let query = supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (activeFolderId === null) {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', activeFolderId);
      }

      if (pageParam?.created_at) {
        query = query.lt('created_at', pageParam.created_at);
      }

      const { data, error } = await query.limit(PAGE_SIZE);
      if (error) throw error;
      return { data: data as Folder[] };
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

export const useCreateFolderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      parentId,
      userId,
    }: {
      name: string;
      parentId: string | null;
      userId: string;
    }) => {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          name: name.trim(),
          parent_id: parentId,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { parentId }) => {
      queryClient.invalidateQueries({ queryKey: ['folders', parentId] });
      queryClient.invalidateQueries({ queryKey: ['picker-folders', parentId] });
    },
  });
};

export const useDeleteFolderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase.from('folders').delete().eq('id', folderId);
      if (error) throw error;
    },
    onSuccess: (_, folderId) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['picker-folders'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    },
  });
};

export const useMoveFolderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      folderId,
      destinationFolderId,
    }: {
      folderId: string;
      destinationFolderId: string | null;
    }) => {
      const { error } = await supabase
        .from('folders')
        .update({ parent_id: destinationFolderId })
        .eq('id', folderId);

      if (error) throw error;
    },
    onSuccess: (_, { destinationFolderId }) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['picker-folders'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    },
  });
};