'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { TeamView } from '@campus-pubquiz/types';
import { RosterMarquee } from '@/app/display/roster-marquee';
import { useLobbyChime } from '@/app/lib/use-lobby-chime';

const TEAM_CHIP_TEXT_CLASSES = [
  'text-cyan',
  'text-magenta',
  'text-green',
  'text-orange',
];

interface TeamRosterProps {
  teams: TeamView[];
  isConnected: boolean;
}

export function TeamRoster({ teams, isConnected }: TeamRosterProps) {
  const teamIdsAtLoad = useLobbyChime(teams, isConnected);
  const isReducedMotion = useReducedMotion();

  // Teams that joined after the roster appeared pop in; reduced motion fades.
  const renderTeamName = (team: TeamView, index: number) => (
    <motion.span
      key={team.teamId}
      initial={
        teamIdsAtLoad.has(team.teamId)
          ? false
          : { opacity: 0, scale: isReducedMotion ? 1 : 0.4 }
      }
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      className={`font-display text-display-2xl whitespace-nowrap ${TEAM_CHIP_TEXT_CLASSES[index % TEAM_CHIP_TEXT_CLASSES.length]}`}
    >
      {team.teamName}
    </motion.span>
  );

  return (
    <div
      aria-label="Connected teams"
      className="flex flex-col items-center gap-3 px-16 pt-6 pb-10"
    >
      <p className="text-display-lg font-extrabold tracking-wide">
        {teams.length} {teams.length === 1 ? 'TEAM' : 'TEAMS'} JOINED
      </p>
      <RosterMarquee
        items={teams}
        renderItems={() => teams.map(renderTeamName)}
      />
    </div>
  );
}
