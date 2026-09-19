# Testing

Use Node’s built-in `node:test` runner and `node:assert/strict`. The initial suite
tests plain JavaScript modules without installing a framework, starting Vite,
loading credentials, or accessing Supabase. Use Node 22 or newer.

## Commands

```sh
npm test                       # All unit and integration tests
npm run test:unit              # One-module behavior
npm run test:integration       # Behavior across application helpers
npm run test:watch             # Optional continuous local feedback
node --test tests/unit/songLinks.test.js
node --test --test-name-pattern="canonical links" tests/integration/songResults.test.js
```

Before every commit, agents must run `npm test` and then `npm run build`, per
`CLAUDE.md`. Both must pass on the final changes being committed, including
documentation-only changes. Fix any failures and rerun both commands after further
edits; do not commit while either check fails. No extra user request is needed.
These checks do not authorize dev servers, browser automation, or database migrations.

## Layout

```text
tests/
  fixtures/league.js               Fresh song, player, vote, round, and settings data
  unit/songLinks.test.js           Direct links, search fallbacks, validation
  unit/scoring.test.js             Self-votes, duplicate totals, tied ranks
  unit/schedule.test.js            Pacific midnight, DST, scored-round eligibility
  integration/songResults.test.js  Scoring → links/copy lists and schedule → standings
```

Keep test files directly inside `unit/` or `integration/` and name them
`<module-or-feature>.test.js`; the npm commands discover those files automatically.
Fixtures are not test files and contain no assertions or side effects.

## Patterns

- Group related behavior with `describe`; name each `it` after a user-visible rule.
- Arrange inputs, call the real public helper, then assert the expected outcome.
- Assert specific results, including failure cases. Do not just check that a
  function ran, returned a value, or agreed with a second copy of its own logic.
- Use fixture factories with explicit overrides; never mutate shared fixture data.
- Pass fixed dates with UTC offsets into scheduling helpers. Never rely on today,
  the machine’s timezone, random IDs, or real-time sleeps.
- Use table-driven cases for equivalent services and boundary conditions. Keep
  expected values independent of production constants that could change incorrectly.
- For regressions, write the failing behavior first, make the smallest fix, then
  rerun the affected suite. Do not change expected values just to obtain a pass.
- Integration tests call several real helpers together. They do not mean live
  Supabase tests. Confirm outputs such as standings, links, and copy text, not
  private function calls or source-code strings.
- Keep tests independent of execution order. Restore any mocks after each test;
  prefer explicit inputs over global mocks whenever possible.

Example:

```js
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { songLinksFor } from '../../src/lib/songLinks.js'
import { makeSong } from '../fixtures/league.js'

it('keeps Spotify searchable when its link is blank', () => {
  const song = makeSong({ artist: 'Example', title: 'Track' })

  const links = songLinksFor(song, { includeSearchFallbacks: true })

  assert.deepEqual(links.find(link => link.label === 'Spotify'), {
    label: 'Spotify',
    url: 'https://open.spotify.com/search/Example%20Track',
    isSearch: true,
  })
})
```

## Scope and future coverage

The initial suite covers song links and representative scoring/scheduling rules.
It does not render React, exercise forms or debounced vote writes, verify database
policies or migrations, or prove external streaming URLs are reachable.

For future React interaction tests, add a JSX-capable runner and DOM testing tools
as a deliberate extension. Assert accessible controls and user interactions, not
markup snapshots. Mock the data/mutation boundary instead of making real network
requests. Database integration tests should use a separate disposable local
database and a separate opt-in command; never the project in `.env.local`.
