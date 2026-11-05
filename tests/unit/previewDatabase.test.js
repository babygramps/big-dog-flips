import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPreviewDatabase } from '../../src/dev/previewDatabase.js'

describe('isolated local site preview', () => {
  it('provides sample songs with submitters and keeps ballots scoped to their voter', async () => {
    const { client, players } = createPreviewDatabase()
    const { data: songs } = await client.from('songs').select().eq('player_id', players[1].id)
    assert.equal(songs.length, 1)
    assert.equal(songs[0].title, 'This Must Be the Place')
    assert.equal(songs[0].players.name, 'Alex')
    const ballot = { round_id: songs[0].round_id, song_id: songs[0].id, voter_player_id: players[0].id, points: 1 }
    await client.from('votes').upsert(ballot, { onConflict: 'song_id,voter_player_id' })
    await client.from('votes').upsert({ ...ballot, points: 3 }, { onConflict: 'song_id,voter_player_id' })
    const { data: votes } = await client.from('votes').select().eq('voter_player_id', players[0].id)
    assert.equal(votes.length, 1)
    assert.equal(votes[0].points, 3)
    await client.from('votes').delete().eq('song_id', ballot.song_id).eq('voter_player_id', players[0].id)
    assert.deepEqual((await client.from('votes').select().eq('voter_player_id', players[0].id)).data, [])
    assert.equal((await client.from('votes').select()).data.length, 8)
  })

  it('updates sample comments, notifies listeners, and resets on a fresh preview', async () => {
    const { client, players } = createPreviewDatabase()
    let notifications = 0
    const channel = client.channel('preview').on('postgres_changes', {}, () => notifications++).subscribe()
    const { data: rounds } = await client.from('rounds').select()
    await client.from('comments').insert({ round_id: rounds[0].id, player_id: players[0].id, body: 'Great pick!' })
    const { data: comments } = await client.from('comments').select().eq('player_id', players[0].id)
    assert.equal(comments[0].body, 'Great pick!')
    assert.equal(comments[0].players.name, 'Rick')
    assert.equal(notifications, 1)
    client.removeChannel(channel)
    assert.equal((await createPreviewDatabase().client.from('comments').select()).data.length, 1)
  })
  it('keeps Side B discussion and likes separate while exposing real artwork', async () => {
    const { client, players } = createPreviewDatabase()
    const { data: songs } = await client.from('bonus_songs').select()
    assert.match(songs[0].artwork_url, /^https:\/\//)
    const song = songs[0]
    const { data: saved } = await client.from('bonus_comments').insert({
      round_id: song.round_id, song_id: song.id, player_id: players[0].id,
      body: 'Bonus pick!\nSecond line.', gif_url: 'https://example.com/sample.gif',
    }).select().single()
    assert.equal(saved.body, 'Bonus pick!\nSecond line.')
    assert.equal(saved.players.name, 'Rick')
    await client.from('bonus_comment_likes').upsert({ comment_id: saved.id, player_id: players[1].id }, { onConflict: 'comment_id,player_id' })
    const { data: likes } = await client.from('bonus_comment_likes').select().eq('bonus_comments.round_id', song.round_id)
    assert.equal(likes.length, 1)
    assert.equal((await client.from('comments').select()).data.length, 1)
    assert.equal((await client.from('comment_likes').select()).data.length, 0)
    await client.from('bonus_comment_likes').delete().eq('comment_id', saved.id).eq('player_id', players[1].id)
    await client.from('bonus_comments').delete().eq('id', saved.id).eq('player_id', players[0].id)
    assert.equal((await client.from('bonus_comments').select()).data.length, 1)
    assert.equal((await client.from('bonus_comment_likes').select()).data.length, 0)
  })

})
