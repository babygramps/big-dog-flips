import { Link } from 'react-router-dom'
import { useSettings } from '../App.jsx'

export default function HowToPlayPage() {
  const { settings } = useSettings()
  const points = settings?.points_per_player ?? 3

  return (
    <main className="page how-to-play-page">
      <header className="page-header">
        <div>
          <h1>How to play</h1>
          <p>Pick a song. Listen to the others. Vote for your favorites.</p>
        </div>
        <Link to="/">Back to Home</Link>
      </header>

      <div className="stack">
        <section className="card">
          <h2>1. Submit a song</h2>
          <p>Read the theme on Home. Add one song that fits, with its artist and title. Add a listening link if you have one.</p>
          <p>You can change your pick until submissions close.</p>
        </section>

        <section className="card">
          <h2>2. Listen and vote</h2>
          <p>Listen to the songs in your side of the round. Give out all {points} {points === 1 ? 'point' : 'points'} using the vote controls.</p>
          <p>Split your points between songs or give them all to one. You cannot vote for your own song.</p>
          <p>Votes save automatically. You can change them until voting closes.</p>
        </section>

        <section className="card">
          <h2>3. See the results</h2>
          <p>When voting ends, see who picked each song and how many points it earned. The highest score wins the round.</p>
          <p>Find past results in <Link to="/rounds">Rounds</Link> and season standings in <Link to="/players">Players</Link>.</p>
        </section>

        <section className="card">
          <h2>A few things to know</h2>
          <ul>
            <li>Check Home for deadlines. All times are Pacific.</li>
            <li>If the round has two sides, vote only on yours. You can still listen and comment on the other side.</li>
            <li>Song submitters stay hidden during voting. Comments use aliases, but profile photos stay visible.</li>
            <li>If matching songs are merged after voting, their scores are combined, votes from their submitters are removed, and one bonus point is added per extra submitter. Each submitter gets that score.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
