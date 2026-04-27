import { useEffect, useCallback } from 'react';
import { useTeamStore } from '@/stores';
import { api } from '@/services';

export function useTeams() {
  const { teams, members, setTeams, setMembers, setLoading, setCurrentTeam } = useTeamStore();

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.teams.list();
      setTeams(data);
      if (data.length > 0 && !useTeamStore.getState().currentTeam) {
        setCurrentTeam(data[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [setTeams, setCurrentTeam, setLoading]);

  const fetchMembers = useCallback(async (teamId: string) => {
    const data = await api.teams.members(teamId);
    setMembers(data);
  }, [setMembers]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return { teams, members, fetchTeams, fetchMembers, setCurrentTeam };
}
