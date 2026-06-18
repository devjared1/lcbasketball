import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { BoxScoreRow, Game, Player, StatEvent, StatType } from '@/types'

const players = ref<Player[]>([])
const games = ref<Game[]>([])
const events = ref<StatEvent[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useStats() {
  async function fetchPlayers() {
    if (!isSupabaseConfigured) {
      error.value = 'Supabase not configured — see README.'
      return
    }
    const { data, error: err } = await supabase
      .from('players')
      .select('*')
      .order('number', { ascending: true })
    if (err) error.value = err.message
    else players.value = (data ?? []) as Player[]
  }

  async function fetchGames() {
    const { data, error: err } = await supabase
      .from('games')
      .select('*')
      .order('played_on', { ascending: false })
    if (err) error.value = err.message
    else games.value = (data ?? []) as Game[]
  }

  async function fetchEvents(gameId: string) {
    loading.value = true
    const { data, error: err } = await supabase
      .from('stat_events')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
    if (err) error.value = err.message
    else events.value = (data ?? []) as StatEvent[]
    loading.value = false
  }

  async function addPlayer(p: Omit<Player, 'id'>): Promise<Player | null> {
    const { data, error: err } = await supabase.from('players').insert(p).select().single()
    if (err) {
      error.value = err.message
      return null
    }
    players.value = [...players.value, data as Player].sort(
      (a, b) => (a.number ?? 999) - (b.number ?? 999),
    )
    return data as Player
  }

  async function createGame(g: Omit<Game, 'id' | 'created_at'>): Promise<Game | null> {
    const { data, error: err } = await supabase.from('games').insert(g).select().single()
    if (err) {
      error.value = err.message
      return null
    }
    games.value = [data as Game, ...games.value]
    return data as Game
  }

  // Append-only: record one stat event (the audit trail). Undo deletes the last.
  async function recordStat(
    gameId: string,
    playerId: string,
    stat: StatType,
  ): Promise<StatEvent | null> {
    const { data, error: err } = await supabase
      .from('stat_events')
      .insert({ game_id: gameId, player_id: playerId, stat })
      .select()
      .single()
    if (err) {
      error.value = err.message
      return null
    }
    events.value = [...events.value, data as StatEvent]
    return data as StatEvent
  }

  async function undoLastFor(playerId: string): Promise<boolean> {
    const playerEvents = events.value.filter((e) => e.player_id === playerId)
    const last = playerEvents[playerEvents.length - 1]
    if (!last) return false
    const { error: err } = await supabase.from('stat_events').delete().eq('id', last.id)
    if (err) {
      error.value = err.message
      return false
    }
    events.value = events.value.filter((e) => e.id !== last.id)
    return true
  }

  return {
    players,
    games,
    events,
    loading,
    error,
    fetchPlayers,
    fetchGames,
    fetchEvents,
    addPlayer,
    createGame,
    recordStat,
    undoLastFor,
  }
}

// ---------- Pure aggregation helpers (no Supabase, easy to unit test) ----------

function emptyRow(p: Player): BoxScoreRow {
  return {
    player_id: p.id,
    name: p.name,
    number: p.number,
    pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
    oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
  }
}

export function buildBoxScore(roster: Player[], evts: StatEvent[]): BoxScoreRow[] {
  const rows = new Map<string, BoxScoreRow>()
  for (const p of roster) rows.set(p.id, emptyRow(p))

  for (const e of evts) {
    const row = rows.get(e.player_id)
    if (!row) continue
    switch (e.stat) {
      case 'fg_made': row.fgm++; row.fga++; row.pts += 2; break
      case 'fg_miss': row.fga++; break
      case 'three_made': row.tpm++; row.tpa++; row.fgm++; row.fga++; row.pts += 3; break
      case 'three_miss': row.tpa++; row.fga++; break
      case 'ft_made': row.ftm++; row.fta++; row.pts += 1; break
      case 'ft_miss': row.fta++; break
      case 'rebound_off': row.oreb++; row.reb++; break
      case 'rebound_def': row.dreb++; row.reb++; break
      case 'assist': row.ast++; break
      case 'steal': row.stl++; break
      case 'block': row.blk++; break
      case 'turnover': row.tov++; break
      case 'foul': row.pf++; break
    }
  }
  return [...rows.values()].sort((a, b) => b.pts - a.pts)
}

export function boxScoreToCsv(rows: BoxScoreRow[], gameLabel: string): string {
  const header = [
    'Game', 'No', 'Player', 'PTS', 'FGM', 'FGA', '3PM', '3PA', 'FTM', 'FTA',
    'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PF',
  ]
  const lines = rows.map((r) =>
    [
      gameLabel, r.number ?? '', r.name, r.pts, r.fgm, r.fga, r.tpm, r.tpa,
      r.ftm, r.fta, r.oreb, r.dreb, r.reb, r.ast, r.stl, r.blk, r.tov, r.pf,
    ]
      .map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v))
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
