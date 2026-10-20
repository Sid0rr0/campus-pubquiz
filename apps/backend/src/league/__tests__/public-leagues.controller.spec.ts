import { NotFoundException } from '@nestjs/common';
import { PublicLeaguesController } from '@/league/public-leagues.controller';
import type { LeagueTableService } from '@/league/league-table.service';

function makeController() {
  const service = { publicLeagues: jest.fn(), table: jest.fn() };
  const controller = new PublicLeaguesController(
    service as unknown as LeagueTableService,
  );
  return { controller, service };
}

describe('PublicLeaguesController', () => {
  it('has no auth guards: the league page is public', () => {
    expect(
      Reflect.getMetadata('__guards__', PublicLeaguesController),
    ).toBeUndefined();
  });

  it('lists the public leagues', async () => {
    const { controller, service } = makeController();
    service.publicLeagues.mockResolvedValue({ items: [] });

    expect(await controller.list()).toEqual({ items: [] });
  });

  it('returns a league table', async () => {
    const { controller, service } = makeController();
    service.table.mockResolvedValue({ id: 3, rows: [] });

    expect(await controller.table(3)).toEqual({ id: 3, rows: [] });
    expect(service.table).toHaveBeenCalledWith(3);
  });

  it('an unknown league is a 404', async () => {
    const { controller, service } = makeController();
    service.table.mockResolvedValue(null);

    await expect(controller.table(9)).rejects.toThrow(NotFoundException);
  });
});
