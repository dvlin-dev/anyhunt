import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { topicKeys } from '../topics/hooks';
import { skillsApi } from './api';

export const skillKeys = {
  all: ['skills'] as const,
  list: () => [...skillKeys.all, 'list'] as const,
  detail: (skillId: string) => [...skillKeys.all, 'detail', skillId] as const,
};

export function useSkills() {
  return useQuery({ queryKey: skillKeys.list(), queryFn: skillsApi.list });
}

export function useSkill(skillId: string) {
  return useQuery({
    queryKey: skillKeys.detail(skillId),
    queryFn: () => skillsApi.get(skillId),
    enabled: Boolean(skillId),
  });
}

export function useImportSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: { url: string } | { file: File }) =>
      'url' in source ? skillsApi.importUrl(source.url) : skillsApi.importFile(source.file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: skillKeys.list() }),
  });
}

export function useSkillStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, enabled }: { skillId: string; enabled: boolean }) =>
      skillsApi.setEnabled(skillId, enabled),
    onSuccess: (skill) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: skillKeys.list() }),
        queryClient.invalidateQueries({ queryKey: skillKeys.detail(skill.id) }),
      ]),
  });
}

export function useTopicSkill(topicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, attached }: { skillId: string; attached: boolean }) =>
      attached ? skillsApi.attach(skillId, topicId) : skillsApi.detach(skillId, topicId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: topicKeys.detail(topicId) }),
  });
}
