import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { queueMutation } from '@/components/utils/offlineSync';

/**
 * Centralized cleaning data fetching and mutations.
 * Handles offline sync, completion tracking, and reporting.
 */
export function useCleaningData() {
  const queryClient = useQueryClient();

  // Fetch all data
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name')
  });

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ['cleaning'],
    queryFn: () => base44.entities.CleaningTask.list('area')
  });

  const { data: allAreas = [] } = useQuery({
    queryKey: ['cleaning-areas'],
    queryFn: () => base44.entities.CleaningArea.list('order')
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['all-employees'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true })
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['cleaning-reports'],
    queryFn: () => base44.entities.CleaningReport.list('-created_date', 20)
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => base44.entities.Shift.list('-date', 3000) // ⚠️ war ohne jedes Limit (SDK-Default), jetzt explizit gross genug
  });

  // Derived data
  const currentMonth = new Date().getMonth() + 1;
  const isSeason = currentMonth >= 4 && currentMonth <= 10;
  const areas = allAreas.filter(area => !area.seasonal || isSeason);
  
  const tasks = allTasks.filter(t => t.is_active !== false);
  const deactivatedTasks = allTasks.filter(t => t.is_active === false);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CleaningTask.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cleaning']);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (!navigator.onLine) {
        await queueMutation({ entityName: 'CleaningTask', type: 'update', id, data });
        queryClient.setQueryData(['cleaning'], (old) => 
          old?.map(task => task.id === id ? { ...task, ...data } : task) || old
        );
        return { queued: true };
      }
      return base44.entities.CleaningTask.update(id, data);
    },
    onSuccess: (result) => {
      if (!result?.queued) queryClient.invalidateQueries(['cleaning']);
    }
  });

  const createReportMutation = useMutation({
    mutationFn: (report) => base44.entities.CleaningReport.create(report),
    onSuccess: () => {
      queryClient.invalidateQueries(['cleaning-reports']);
    }
  });

  return {
    // Data
    user,
    employees,
    tasks,
    deactivatedTasks,
    allTasks,
    areas,
    allAreas,
    allEmployees,
    reports,
    shifts,
    isLoading,

    // Mutations
    createMutation,
    updateMutation,
    createReportMutation,

    // Derived
    completedCount: tasks.filter(t => t.is_completed).length,
    progress: tasks.length > 0 ? (tasks.filter(t => t.is_completed).length / tasks.length) * 100 : 0,
  };
}