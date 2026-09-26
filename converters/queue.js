const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_CONVERSIONS || '1', 10)

class ConversionQueue {
  constructor(maxConcurrent = MAX_CONCURRENT) {
    this.maxConcurrent = maxConcurrent
    this.activeCount = 0
    this.queue = []
  }

  /**
   * Returns current active and waiting count
   */
  getStatus() {
    return {
      active: this.activeCount,
      waiting: this.queue.length,
      max: this.maxConcurrent
    }
  }

  /**
   * Enqueues an async task and executes when a worker slot is available
   * @param {() => Promise<any>} taskFunction
   * @returns {Promise<any>}
   */
  async run(taskFunction) {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++
      try {
        return await taskFunction()
      } finally {
        this.activeCount--
        this._next()
      }
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        taskFunction,
        resolve,
        reject
      })
    })
  }

  _next() {
    if (this.queue.length === 0 || this.activeCount >= this.maxConcurrent) {
      return
    }

    const { taskFunction, resolve, reject } = this.queue.shift()
    this.activeCount++

    Promise.resolve()
      .then(taskFunction)
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.activeCount--
        this._next()
      })
  }
}

const globalConversionQueue = new ConversionQueue()

module.exports = {
  globalConversionQueue,
  ConversionQueue
}
