import type { User, Session, Drawing, DrawingRevision, Team, TeamMembership, TeamInvite, Template, Folder, ActivityEvent } from '@/types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export const api = {
  auth: {
    me: (): Promise<User> => fetchApi('/auth/me'),
    setupStatus: (): Promise<{ has_users: boolean }> => fetchApi('/auth/setup-status'),
    login: (email: string, password: string): Promise<{ user: User; session: Session }> =>
      fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    signup: (name: string, email: string, password: string): Promise<{ user: User; session: Session }> =>
      fetchApi('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
    logout: (): Promise<void> => fetchApi('/auth/logout', { method: 'POST' }),
  },
  drawings: {
    list: (teamId?: string): Promise<Drawing[]> =>
      fetchApi(`/drawings${teamId ? `?team_id=${teamId}` : ''}`),
    get: (id: string): Promise<Drawing> => fetchApi(`/drawings/${id}`),
    create: (data: object): Promise<Drawing> =>
      fetchApi('/drawings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object): Promise<Drawing> =>
      fetchApi(`/drawings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string): Promise<void> =>
      fetchApi(`/drawings/${id}`, { method: 'DELETE' }),
  },
  revisions: {
    list: (drawingId: string): Promise<DrawingRevision[]> =>
      fetchApi(`/drawings/${drawingId}/revisions`),
    create: (drawingId: string, snapshot: object, changeSummary?: string): Promise<DrawingRevision> =>
      fetchApi(`/drawings/${drawingId}/revisions`, {
        method: 'POST',
        body: JSON.stringify({ snapshot, change_summary: changeSummary }),
      }),
  },
  folders: {
    list: (): Promise<Folder[]> => fetchApi('/folders'),
    create: (data: object): Promise<Folder> =>
      fetchApi('/folders', { method: 'POST', body: JSON.stringify(data) }),
  },
  teams: {
    list: (): Promise<Team[]> => fetchApi('/teams'),
    create: (data: { name: string; slug: string }): Promise<Team> => fetchApi('/teams', { method: 'POST', body: JSON.stringify(data) }),
    members: (teamId: string): Promise<TeamMembership[]> => fetchApi(`/teams/${teamId}/members`),
    invites: (teamId: string): Promise<TeamInvite[]> => fetchApi(`/teams/${teamId}/invites`),
    createInvite: (teamId: string, data: { email: string; role: string }): Promise<TeamInvite> => fetchApi(`/teams/${teamId}/invites`, { method: 'POST', body: JSON.stringify(data) }),
    acceptInvite: (token: string): Promise<void> => fetchApi('/invites/accept', { method: 'POST', body: JSON.stringify({ token }) }),
    createUser: (teamId: string, data: { name: string; email: string; password: string; role: string }): Promise<User> => fetchApi(`/teams/${teamId}/users`, { method: 'POST', body: JSON.stringify(data) }),
  },
  templates: {
    list: (): Promise<Template[]> => fetchApi('/templates'),
    create: (data: { name: string; type: string; scope: string }): Promise<Template> =>
      fetchApi('/templates', { method: 'POST', body: JSON.stringify(data) }),
  },
  stats: {
    get: (teamId?: string): Promise<{
      teams: number;
      members: number;
      projects: number;
      folders: number;
      drawings: number;
      templates: number;
      revisions: number;
      assets: number;
      storage_bytes: number;
    }> => fetchApi(`/stats${teamId ? `?team_id=${teamId}` : ''}`),
  },
  activity: {
    list: (): Promise<ActivityEvent[]> => fetchApi('/activity'),
  },
  search: {
    get: (q: string): Promise<Drawing[]> => fetchApi(`/search?q=${encodeURIComponent(q)}`),
  },
};
