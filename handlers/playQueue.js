const queues = new Map()
const playing = new Set()

async function enqueue(jid, task) {
  if (!queues.has(jid)) queues.set(jid, [])
  const queue = queues.get(jid)

  queue.push(task)

  if (!playing.has(jid)) {
    processNext(jid)
  }

  return queue.length
}

async function processNext(jid) {
  const queue = queues.get(jid)

  if (!queue || queue.length === 0) {
    playing.delete(jid)
    return
  }

  playing.add(jid)
  const task = queue.shift()

  try {
    await task()
  } catch (err) {
    console.error('[QUEUE] Task failed:', err)
  }

  processNext(jid)
}

function getQueueLength(jid) {
  return queues.get(jid)?.length || 0
}

module.exports = { enqueue, getQueueLength }
