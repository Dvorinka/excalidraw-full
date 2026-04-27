import { useEffect, useCallback } from 'react';
import { useDrawingStore, useTeamStore } from '@/stores';
import { api } from '@/services';

export function useDrawings() {
  const { drawings, recentDrawings, setDrawings, setRecentDrawings, setLoading, addDrawing, updateDrawing } = useDrawingStore();
  const { currentTeam } = useTeamStore();

  const fetchDrawings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.drawings.list(currentTeam?.id);
      setDrawings(data);
      setRecentDrawings(data.slice(0, 10));
    } finally {
      setLoading(false);
    }
  }, [currentTeam?.id, setDrawings, setRecentDrawings, setLoading]);

  useEffect(() => {
    fetchDrawings();
  }, [fetchDrawings]);

  const createDrawing = async (title: string, folderId?: string) => {
    const drawing = await api.drawings.create({
      title,
      folder_id: folderId,
      team_id: currentTeam?.id,
    });
    addDrawing(drawing);
    return drawing;
  };

  return { drawings, recentDrawings, fetchDrawings, createDrawing, updateDrawing };
}
