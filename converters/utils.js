const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

const MAX_SIZE_MB = parseInt(process.env.MAX_CONVERSION_SIZE_MB || '30', 10)
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const TIMEOUT_SECONDS = parseInt(process.env.CONVERSION_TIMEOUT_SECONDS || '120', 10)
const TIMEOUT_MS = TIMEOUT_SECONDS * 1000

const BASE_TEMP_DIR = path.join(__dirname, '../temp/conversions')

// Ensure base temp directory exists
if (!fs.existsSync(BASE_TEMP_DIR)) {
  fs.mkdirSync(BASE_TEMP_DIR, { recursive: true })
}

/**
 * Creates an isolated temp workspace for a single conversion task
 * @returns {string} Absolute path to created folder
 */
function createTempWorkspace() {
  const uniqueId = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
  const workspacePath = path.join(BASE_TEMP_DIR, uniqueId)
  fs.mkdirSync(workspacePath, { recursive: true })
  return workspacePath
}

/**
 * Cleanly removes an isolated temp workspace
 * @param {string} workspacePath
 */
function cleanupTempWorkspace(workspacePath) {
  if (!workspacePath) return
  try {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true })
    }
  } catch (err) {
    console.error(`[CONVERT_UTILS] Failed to remove temp directory ${workspacePath}:`, err.message)
  }
}

/**
 * Streams media from Baileys directly to disk without loading entire buffer into RAM
 * @param {object} messageContent The inner message object (e.g. videoMessage, imageMessage)
 * @param {string} mediaType 'video' | 'audio' | 'image' | 'document'
 * @param {string} destPath Target file path
 * @returns {Promise<{ filePath: string, size: number }>}
 */
async function streamMediaToDisk(messageContent, mediaType, destPath) {
  const stream = await downloadContentFromMessage(messageContent, mediaType)
  const writeStream = fs.createWriteStream(destPath)
  let bytesWritten = 0

  return new Promise((resolve, reject) => {
    let aborted = false

    stream.on('data', chunk => {
      if (aborted) return
      bytesWritten += chunk.length

      if (bytesWritten > MAX_SIZE_BYTES) {
        aborted = true
        writeStream.destroy()
        if (typeof stream.destroy === 'function') stream.destroy()
        fs.unlink(destPath, () => {})
        return reject(new Error(`File size exceeds maximum allowed limit of ${MAX_SIZE_MB} MB.`))
      }

      writeStream.write(chunk)
    })

    stream.on('end', () => {
      if (!aborted) writeStream.end()
    })

    writeStream.on('finish', () => {
      if (!aborted) resolve({ filePath: destPath, size: bytesWritten })
    })

    writeStream.on('error', err => {
      aborted = true
      fs.unlink(destPath, () => {})
      reject(err)
    })

    stream.on('error', err => {
      aborted = true
      writeStream.destroy()
      fs.unlink(destPath, () => {})
      reject(err)
    })
  })
}

/**
 * Runs a native command asynchronously via spawn() with a hard timeout
 * @param {string} command Executable name or path (e.g. 'ffmpeg', 'ffprobe', 'pdftoppm')
 * @param {string[]} args Array of arguments
 * @param {string} [cwd] Working directory
 * @param {number} [customTimeoutMs] Optional custom timeout in ms
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function runAsyncProcess(command, args, cwd = process.cwd(), customTimeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(command, args, { cwd })
    } catch (err) {
      return reject(new Error(`Failed to spawn ${command}: ${err.message}`))
    }

    let stdout = ''
    let stderr = ''
    let completed = false

    const timer = setTimeout(() => {
      if (completed) return
      completed = true
      try {
        child.kill('SIGKILL')
      } catch (_) {}
      reject(new Error(`${command} timed out after ${Math.round(customTimeoutMs / 1000)} seconds.`))
    }, customTimeoutMs)

    if (child.stdout) {
      child.stdout.on('data', d => { stdout += d.toString() })
    }
    if (child.stderr) {
      child.stderr.on('data', d => { stderr += d.toString() })
    }

    child.on('close', code => {
      if (completed) return
      completed = true
      clearTimeout(timer)

      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        const errorDetails = stderr.trim().slice(-400) || stdout.trim().slice(-400) || `Process exited with code ${code}`
        reject(new Error(`${command} failed: ${errorDetails}`))
      }
    })

    child.on('error', err => {
      if (completed) return
      completed = true
      clearTimeout(timer)
      reject(err)
    })
  })
}

module.exports = {
  MAX_SIZE_MB,
  MAX_SIZE_BYTES,
  TIMEOUT_SECONDS,
  TIMEOUT_MS,
  createTempWorkspace,
  cleanupTempWorkspace,
  streamMediaToDisk,
  runAsyncProcess
}
