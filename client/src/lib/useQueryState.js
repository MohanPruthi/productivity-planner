import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// useQuery plus a setState-style setter that edits the cached answer, so a page's
// existing optimistic updates (setX(prev => ...)) keep working on the shared cache.
// An updater is skipped while nothing is cached yet for the key.
export const useQueryState = (options) => {
  const queryClient = useQueryClient();
  const query = useQuery(options);
  const keyHash = JSON.stringify(options.queryKey);
  const setData = useCallback((updater) => {
    queryClient.setQueryData(JSON.parse(keyHash), (prev) => {
      if (typeof updater !== 'function') return updater;
      return prev === undefined ? prev : updater(prev);
    });
  }, [queryClient, keyHash]);
  return [query.data, setData, query];
};
