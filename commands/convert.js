const fs = require('fs')
const path = require('path')
const {
  createTempWorkspace,
  cleanupTempWorkspace,
  streamMediaToDisk,
  MAX_SIZE_MB
} = require('../converters/utils')
const { probeMedia } = require('../converters/probe')
const { globalConversionQueue } = require('../converters/queue')
const {
  CATEGORIES,
  detectCategory,
  formatConversionMenu
} = require('../converters')

/**
 * Extracts media content and mediaType string from current message or quoted message
 * @param {object} msg Full Baileys message object
 * @returns {{ mediaContent: object, mediaType: string, mimetype: string, fileName?: string } | null}
 */
function extractMediaTarget(msg) {
  const m = msg.message
  if (!m) return null

  // 1. Direct media attachment in this message
  if (m.videoMessage) {
    return {
      mediaContent: m.videoMessage,
      mediaType: 'video',
      mimetype: m.videoMessage.mimetype || 'video/mp4',
      fileName: 'input.mp4'
    }
  }
  if (m.imageMessage) {
    return {
      mediaContent: m.imageMessage,
      mediaType: 'image',
      mimetype: m.imageMessage.mimetype || 'image/jpeg',
      fileName: 'input.jpg'
    }
  }
  if (m.audioMessage) {
    return {
      mediaContent: m.audioMessage,
      mediaType: 'audio',
      mimetype: m.audioMessage.mimetype || 'audio/ogg',
      fileName: 'input.ogg'
    }
  }
  if (m.documentMessage || m.documentWithCaptionMessage?.message?.documentMessage) {
    const doc = m.documentMessage || m.documentWithCaptionMessage?.message?.documentMessage
    return {
      mediaContent: doc,
      mediaType: 'document',
      mimetype: doc.mimetype || 'application/octet-stream',
      fileName: doc.fileName || 'document'
    }
  }

  // 2. Quoted message media
  const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage
  if (quoted) {
    if (quoted.videoMessage) {
      return {
        mediaContent: quoted.videoMessage,
        mediaType: 'video',
        mimetype: quoted.videoMessage.mimetype || 'video/mp4',
        fileName: 'input.mp4'
      }
    }
    if (quoted.imageMessage) {
      return {
        mediaContent: quoted.imageMessage,
        mediaType: 'image',
        mimetype: quoted.imageMessage.mimetype || 'image/jpeg',
        fileName: 'input.jpg'
      }
    }
    if (quoted.stickerMessage) {
      return {
        mediaContent: quoted.stickerMessage,
        mediaType: 'image',
        mimetype: 'image/webp',
        fileName: 'sticker.webp'
      }
    }
    if (quoted.audioMessage) {
      return {
        mediaContent: quoted.audioMessage,
        mediaType: 'audio',
        mimetype: quoted.audioMessage.mimetype || 'audio/ogg',
        fileName: 'input.ogg'
      }
    }
    if (quoted.documentMessage || quoted.documentWithCaptionMessage?.message?.documentMessage) {
      const doc = quoted.documentMessage || quoted.documentWithCaptionMessage?.message?.documentMessage
      return {
        mediaContent: doc,
        mediaType: 'document',
        mimetype: doc.mimetype || 'application/octet-stream',
        fileName: doc.fileName || 'document'
      }
    }
  }

  return null
}

/**
 * Handles the .convert command
 */
async function handleConvertCommand({ command, args, sock, jid, msg }) {
  if (command !== 'convert') return false

  const mediaTarget = extractMediaTarget(msg)

  if (!mediaTarget) {
    await sock.sendMessage(jid, {
      text:
`🔄 *Yaadobot File Converter*

*How to use:*
1️⃣ *Send media with caption:*
   • \`.convert mp3\` (Video ➔ MP3)
   • \`.convert pdf\` (Images ➔ PDF)
   • \`.convert webp\` (Image ➔ WebP)

2️⃣ *Reply to any media in chat:*
   • Reply with \`.convert <format>\`

3️⃣ *Inspect available formats:*
   • Reply with just \`.convert\` to see all valid formats for that specific file!

_Max file size: ${MAX_SIZE_MB} MB_`
    }, { quoted: msg })
    return true
  }

  const requestedFormat = (args[0] || '').toLowerCase().replace(/^[.]+/, '').trim()

  // Case A: No format provided — inspect and recommend available formats
  if (!requestedFormat) {
    let workspace = null
    try {
      workspace = createTempWorkspace()
      const ext = path.extname(mediaTarget.fileName) || `.${mediaTarget.mediaType}`
      const probeInputPath = path.join(workspace, `probe${ext}`)

      const { size } = await streamMediaToDisk(mediaTarget.mediaContent, mediaTarget.mediaType, probeInputPath)
      const probeData = await probeMedia(probeInputPath)
      const category = detectCategory(mediaTarget.mimetype, mediaTarget.fileName, probeData)

      const menuText = formatConversionMenu(category, {
        size,
        fileName: mediaTarget.fileName,
        probeData
      })

      await sock.sendMessage(jid, { text: menuText }, { quoted: msg })
    } catch (err) {
      await sock.sendMessage(jid, {
        text: `⚠️ *Could not inspect file:* ${err.message}`
      }, { quoted: msg })
    } finally {
      if (workspace) cleanupTempWorkspace(workspace)
    }
    return true
  }

  // Case B: Direct Conversion
  await sock.sendMessage(jid, {
    react: { text: '⏳', key: msg.key }
  }).catch(() => {})

  const queueStatus = globalConversionQueue.getStatus()
  if (queueStatus.active >= queueStatus.max) {
    await sock.sendMessage(jid, {
      text: '⏳ *Conversion queued...* Server is busy with another conversion task and will process yours shortly.'
    }, { quoted: msg }).catch(() => {})
  }

  // Execute within concurrency queue
  try {
    await globalConversionQueue.run(async () => {
      let workspace = null
      try {
        workspace = createTempWorkspace()
        const origExt = path.extname(mediaTarget.fileName) || `.${mediaTarget.mediaType}`
        const inputFilePath = path.join(workspace, `input${origExt}`)

        // 1. Direct-to-disk streaming (No RAM bloat)
        await streamMediaToDisk(mediaTarget.mediaContent, mediaTarget.mediaType, inputFilePath)

        // 2. Metadata probe via ffprobe
        const probeData = await probeMedia(inputFilePath)
        const category = detectCategory(mediaTarget.mimetype, mediaTarget.fileName, probeData)

        // 3. Dispatch conversion
        let result
        if (requestedFormat === 'zip') {
          // Universal ZIP option
          result = await CATEGORIES.archive.convert(inputFilePath, 'zip', workspace, mediaTarget.fileName)
        } else {
          const catConfig = CATEGORIES[category]
          if (!catConfig) {
            throw new Error(`Cannot convert unknown or unsupported file type (${mediaTarget.mimetype}).`)
          }

          if (!catConfig.targets.includes(requestedFormat)) {
            const available = catConfig.targets.join(', ')
            throw new Error(`Format "${requestedFormat}" is not supported for ${catConfig.label}.\nAvailable options: ${available}`)
          }

          result = await catConfig.convert(inputFilePath, requestedFormat, workspace, probeData)
        }

        // 4. Send converted file back to WhatsApp
        if (result.outputPath) {
          const fileData = await fs.promises.readFile(result.outputPath)

          if (result.mediaType === 'audio') {
            await sock.sendMessage(jid, {
              audio: fileData,
              mimetype: result.mimetype || 'audio/mpeg',
              ptt: !!result.ptt,
              fileName: result.fileName || `converted.${requestedFormat}`
            }, { quoted: msg })
          } else if (result.mediaType === 'video') {
            await sock.sendMessage(jid, {
              video: fileData,
              mimetype: result.mimetype || 'video/mp4',
              gifPlayback: !!result.gifPlayback,
              caption: result.caption
            }, { quoted: msg })
          } else if (result.mediaType === 'image') {
            await sock.sendMessage(jid, {
              image: fileData,
              mimetype: result.mimetype || 'image/jpeg',
              caption: result.caption
            }, { quoted: msg })
          } else {
            // Document (PDF, ZIP, WebM, etc.)
            await sock.sendMessage(jid, {
              document: fileData,
              mimetype: result.mimetype || 'application/octet-stream',
              fileName: result.fileName || `converted.${requestedFormat}`,
              caption: result.caption
            }, { quoted: msg })
          }

          await sock.sendMessage(jid, {
            react: { text: '✅', key: msg.key }
          }).catch(() => {})
        } else if (result.summary) {
          // Archive extraction summary
          await sock.sendMessage(jid, {
            text: `📂 *Extracted Archive Contents:*\n\n${result.summary}`
          }, { quoted: msg })
        }
      } finally {
        if (workspace) cleanupTempWorkspace(workspace)
      }
    })
  } catch (err) {
    console.error('[CONVERT_COMMAND] Conversion error:', err)
    await sock.sendMessage(jid, {
      react: { text: '❌', key: msg.key }
    }).catch(() => {})

    await sock.sendMessage(jid, {
      text: `❌ *Conversion Failed:*\n${err.message}`
    }, { quoted: msg })
  }

  return true
}

module.exports = {
  handleConvertCommand
}
