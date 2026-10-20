import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import type { LeagueTable, PublicLeaguesPayload } from '@campus-pubquiz/types';
import { LeagueTableService } from '@/league/league-table.service';

/**
 * The public league page's data: no login, so nothing here may carry team
 * codes, tokens or feedback. A separate controller from the staff
 * `LeaguesController` so it is unguarded by construction.
 */
@Controller('leagues')
export class PublicLeaguesController {
  constructor(private readonly tables: LeagueTableService) {}

  @Get('public')
  async list(): Promise<PublicLeaguesPayload> {
    return this.tables.publicLeagues();
  }

  @Get(':id/table')
  async table(@Param('id', ParseIntPipe) id: number): Promise<LeagueTable> {
    const table = await this.tables.table(id);
    if (!table) throw new NotFoundException(`League ${id} does not exist`);
    return table;
  }
}
