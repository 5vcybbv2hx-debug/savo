/**
 * Centralized storage data hooks.
 * Use these in all Storage tabs to ensure consistent queries and cache behavior.
 */
import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { base44 } from '@/api/base44Client';
import { QK } from '@/lib/queryKeys';

export function useAreas() {
  return useQuery({
    queryKey: QK.areas(),
    queryFn: () => base44.entities.Area.list('order', 100),
    staleTime: STALE.FAST,
  });
}

export function useFurniture(areaId) {
  return useQuery({
    queryKey: areaId ? QK.furnitureBy(areaId) : QK.furniture(),
    queryFn: () => areaId
      ? base44.entities.Furniture.filter({ area_id: areaId }, 'sort_order', 500)
      : base44.entities.Furniture.list('sort_order', 500),
    staleTime: STALE.FAST,
  });
}

export function useContainers(furnitureId) {
  return useQuery({
    queryKey: furnitureId ? QK.containersBy(furnitureId) : QK.containers(),
    queryFn: () => furnitureId
      ? base44.entities.Container.filter({ furniture_id: furnitureId }, 'sort_order', 500)
      : base44.entities.Container.list('sort_order', 500),
    staleTime: STALE.FAST,
  });
}

export function useSlots(filter) {
  return useQuery({
    queryKey: filter ? QK.slotsBy(filter) : QK.slots(),
    queryFn: () => filter
      ? base44.entities.StorageSlot.filter(filter, 'full_name', 1000)
      : base44.entities.StorageSlot.list('full_name', 1000),
    staleTime: STALE.FAST,
  });
}

export function useAssignments(filter) {
  return useQuery({
    queryKey: filter ? QK.assignmentsBy(filter) : QK.assignments(),
    queryFn: () => filter
      ? base44.entities.StorageAssignment.filter(filter, 'article_name', 1000)
      : base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000),
    staleTime: STALE.FAST,
  });
}

export function useArticles(filter) {
  return useQuery({
    queryKey: filter ? QK.articlesFiltered(filter) : QK.articles(),
    queryFn: () => filter
      ? base44.entities.Article.filter(filter, 'name', 1000)
      : base44.entities.Article.filter({ is_active: true }, 'name', 1000),
    staleTime: STALE.MEDIUM,
  });
}