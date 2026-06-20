# Features

1. - [x] Edit/Delete players
2. - [x] Edit/Delete games
3. - [ ] Multi phase plays. Sometimes plays have several different actions. Need to be able to create and display multiple phases
4. - [ ] Ability to curve all cut lines
5. - [x] Duplicate a play (copy an existing play as a starting point)
6. - [x] Search / filter plays by category or name
7. - [ ] Export a play as a PNG or PDF (screenshot the SVG canvas)
8. - [ ] Print-friendly play sheet (one play per page, diagram + notes)
9. - [ ] Drag-to-reorder plays in the grid
10. - [x] Quick-start marker templates (e.g. 5-out, 4-low, horns) to pre-place players
11. - [ ] Link player markers in a diagram to actual roster players by name
12. - [ ] Opponent scouting section — separate from team playbook, tag plays as "opponent tendency"
13. - [ ] Practice plan builder — drag plays into an ordered session with time slots
14. - [ ] Shot chart — tap a court location during a game to log shot attempts with make/miss
15. - [ ] Quarter / period tracking — split stat events by quarter so box score can show per-quarter splits
16. - [ ] Substitution log — track which players were on the floor each possession
17. - [ ] Season stats view — aggregate box scores across all games into season averages and totals
18. - [ ] PWA / offline support — service worker so the app loads and is usable without a network connection
19. - [ ] Play animation mode — step through multi-phase plays with transitions on the diagram
20. - [ ] Click/Touch drag to move markers on court
21. - [ ] Click/Touch edit an existing cut line on court (extend/shorten, change direction) 

---

# Bugs

1. - [x] Switching court type (half ↔ full) does not reposition existing diagram elements — markers drawn on a half court will appear in the wrong spot if you switch to full court mid-draw
2. - [x] `newDate` in StatsView initializes from `new Date().toISOString()` which is UTC — coaches in US evening sessions will see yesterday's date
3. - [x] `fetchGames` in `useStats` does not guard against Supabase being unconfigured the way `fetchPlayers` does — will throw a cryptic network error instead of the friendly banner
4. - [x] No client-side file-size check before video upload — very large files queue silently and may fail at the Storage level with no actionable message shown to the user
5. - [x] The empty `watch(() => props.modelValue.courtType, () => {})` in `CourtCanvas.vue` is dead code and should be removed
6. - [x] Saving a play does not disable the Save button during the async call — rapid double-taps can create duplicate records

---

# Refactor

1. - [x] Extract court geometry constants (basket position, 3-point radius, key dimensions) from the SVG template into named constants so the magic numbers are documented in one place
2. - [x] Move `buildBoxScore`, `boxScoreToCsv`, and `downloadCsv` out of `useStats.ts` into a `src/lib/stats-utils.ts` — they are pure functions with no Supabase dependency and are easier to unit-test standalone
3. - [x] `usePlays` and `useStats` use module-level refs (singleton state) — this is fine for a single-coach app but should be called out explicitly in comments so it's not surprising if the app ever supports multiple active contexts
4. - [x] The `PlayEditorModal` `save()` handler emits synchronously and doesn't await the Supabase call — the parent `onSave` is async but the modal doesn't track the result; consider passing a loading state back down or lifting error handling into the modal
5. - [x] Wrap the modal `<div>` in `<Teleport to="body">` to avoid potential z-index stacking context issues when the modal is nested inside a transformed or overflow-hidden ancestor
6. - [x] Redo new/edit play UI/UX. Instead of displaying in a modal, route to new page. The new play container should not overflow the screen width or height.
7. - [x] Play category should be a picklist instead of text field. Hardcode categories on client side for now.

---

# UI / UX

1. - [x] UI / UX should feel like a modern iPhone / iPad app
2. - [x] Color palette: Draw from Lawrence County High School in Moulton, AL. Some variation of red, black, grey and white
3. - [x] Icons: Find free library online or importable package. should have the native iPhone / ipad look
     - Used **Heroicons** (free, MIT licensed, designed by the Tailwind CSS team)
4. - [x] Font: Barlow Condensed for display headings; Inter for body text
5. - [x] Swap current orange `rim` accent to **red** to match Lawrence County's school colors
6. - [x] Replace dark `ink-900` background with true black (`#000`) to match iOS dark mode aesthetic on OLED screens
7. - [x] Add a bottom tab bar navigation (Plays / Stats) in place of the current top nav — standard iOS navigation pattern on mobile
8. - [ ] Add LC logo to court

---
