import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTeamCode, fetchTeams, TeamsApiError } from '@/app/lib/teams-api';

const originalFetch = global.fetch;

describe('teams-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchTeams', () => {
    it('requests the given page/sort with credentials included', async () => {
      const payload = { items: [], total: 0, page: 1, pageSize: 20 };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchTeams({
        page: 1,
        pageSize: 20,
        sortBy: 'joinedAt',
        sortOrder: 'desc',
      });

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/teams?page=1&pageSize=20&sortBy=joinedAt&sortOrder=desc',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('throws TeamsApiError with the server message on a non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      }) as unknown as typeof fetch;

      const error = await fetchTeams({
        page: 1,
        pageSize: 20,
        sortBy: 'joinedAt',
        sortOrder: 'desc',
      }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(TeamsApiError);
      expect((error as TeamsApiError).status).toBe(403);
      expect((error as TeamsApiError).message).toBe('Forbidden');
    });
  });

  describe('fetchTeamCode', () => {
    it('requests the team code with credentials included', async () => {
      const payload = { teamId: 1, teamName: 'The Quizzards', code: 'ZEBRA1' };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchTeamCode(1);

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/teams/1/code',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('throws TeamsApiError with the server message on a non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Team not found' }),
      }) as unknown as typeof fetch;

      const error = await fetchTeamCode(999).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(TeamsApiError);
      expect((error as TeamsApiError).status).toBe(404);
      expect((error as TeamsApiError).message).toBe('Team not found');
    });
  });
});
