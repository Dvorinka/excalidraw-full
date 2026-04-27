import React, { useState, useEffect } from 'react';
import { Users, Crown, Shield, User, Loader2, Check, UserPlus } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input } from '@/components';
import { useTeamStore } from '@/stores';
import { api } from '@/services';
import styles from './Team.module.scss';

const roleIcons: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  editor: User,
  viewer: User,
};

const ROLES = ['viewer', 'editor', 'admin'];

export const TeamSettings: React.FC = () => {
  const { currentTeam, members, setMembers, setCurrentTeam } = useTeamStore();
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('editor');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [teamsData, membersData] = await Promise.all([
          api.teams.list(),
          currentTeam ? api.teams.members(currentTeam.id) : Promise.resolve([]),
        ]);
        if (teamsData.length > 0) {
          setCurrentTeam(teamsData[0]);
        }
        setMembers(membersData);
      } catch (err) {
        console.error('Failed to load team data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentTeam?.id, setMembers, setCurrentTeam]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim() || !currentTeam) return;
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSending(true);
    setError('');
    setSent(false);
    try {
      await api.teams.createUser(currentTeam.id, {
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
      const membersData = await api.teams.members(currentTeam.id);
      setMembers(membersData);
      setSent(true);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('editor');
    } catch (err: any) {
      setError(err?.message || 'Failed to create user');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}><Loader2 size={32} className={styles.spinner} /><p>Loading team...</p></div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Team Settings</h1>
        <p className={styles.subtitle} aria-label="Current team">{currentTeam?.name || 'My Team'}</p>
      </div>

      <div className={styles.grid}>
        <Card role="region" aria-label="Team members">
          <CardHeader>
            <h3>Members ({members.length})</h3>
          </CardHeader>
          <CardContent>
            <div className={styles.membersList} role="list" aria-label="Team members list">
              {members.length === 0 ? (
                <div className={styles.empty}>
                  <Users size={32} />
                  <p>No team members yet</p>
                  <p className={styles.emptySub}>Add members to collaborate</p>
                </div>
              ) : (
                members.map((member) => {
                  const RoleIcon = roleIcons[member.role] || User;
                  return (
                    <div key={member.id} className={styles.memberItem} role="listitem" aria-label={`Member ${member.user?.name || 'Unknown'}`}>
                      <div className={styles.memberAvatar} aria-hidden="true">
                        {member.user?.name?.[0] || '?'}
                      </div>
                      <div className={styles.memberInfo}>
                        <p className={styles.memberName}>{member.user?.name || 'Unknown'}</p>
                        <p className={styles.memberEmail}>{member.user?.email}</p>
                      </div>
                      <div className={styles.memberRole} aria-label={`Role: ${member.role}`}>
                        <RoleIcon size={14} aria-hidden="true" />
                        <span>{member.role}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <div className={styles.sidePanel}>
          <Card role="region" aria-label="Add team member">
            <CardHeader>
              <h3>Add Member</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className={styles.inviteForm}>
                <Input
                  type="text"
                  label="Full name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className={styles.inviteInput}
                />
                <Input
                  type="email"
                  label="Email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jane@company.com"
                  required
                  className={styles.inviteInput}
                />
                <Input
                  type="password"
                  label="Initial password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  className={styles.inviteInput}
                />
                <label className={styles.roleLabel}>
                  Role
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={styles.roleSelect}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                {error && <p className={styles.error}>{error}</p>}
                {sent && <p className={styles.success}><Check size={14} /> User created!</p>}
                <Button fullWidth type="submit" loading={sending} disabled={!newName.trim() || !newEmail.trim() || !newPassword.trim()}>
                  <UserPlus size={16} />
                  Create User
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
