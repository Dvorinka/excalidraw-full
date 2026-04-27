import { create } from 'zustand';
import type { Team, TeamMembership, TeamInvite } from '@/types';

interface TeamState {
  currentTeam: Team | null;
  teams: Team[];
  members: TeamMembership[];
  invites: TeamInvite[];
  isLoading: boolean;
  setCurrentTeam: (team: Team | null) => void;
  setTeams: (teams: Team[]) => void;
  addTeam: (team: Team) => void;
  removeTeam: (teamId: string) => void;
  setMembers: (members: TeamMembership[]) => void;
  setInvites: (invites: TeamInvite[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  currentTeam: null,
  teams: [],
  members: [],
  invites: [],
  isLoading: false,
  setCurrentTeam: (team) => set({ currentTeam: team }),
  setTeams: (teams) => set({ teams }),
  addTeam: (team) => set((state) => ({ teams: [...state.teams, team] })),
  removeTeam: (teamId) => set((state) => ({ teams: state.teams.filter((t) => t.id !== teamId) })),
  setMembers: (members) => set({ members }),
  setInvites: (invites) => set({ invites }),
  setLoading: (isLoading) => set({ isLoading }),
}));
