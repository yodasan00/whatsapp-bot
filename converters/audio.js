const path = require('path')
const { runAsyncProcess } = require('./utils')

const SUPPORTED_TARGETS = ['mp3', 'wav', 'm4a', 'ogg', 'opus', 'flac']

/**
 * Converts an audio file to the requested target format
 * @param {string} inputPath Path to source audio file
 * @param {string} targetFormat Target format extension
 * @param {string} workspacePath Temporary workspace folder
 * @returns {Promise<object>} Result payload
 */
async function convertAudio(inputPath, targetFormat, workspacePath) {
  const target = targetFormat.toLowerCase().trim()

  if (!SUPPORTED_TARGETS.includes(target)) {
    throw new Error(`Unsupported audio conversion target: "${target}". Supported: ${SUPPORTED_TARGETS.join(', ')}`)
  }

  switch (target) {
    case 'mp3': {
      const outputPath = path.join(workspacePath, 'output.mp3')
      const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'audio',
        mimetype: 'audio/mpeg',
        fileName: 'audio.mp3',
        ptt: false
      }
    }

    case 'wav': {
      const outputPath = path.join(workspacePath, 'output.wav')
      const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'pcm_s16le',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'document',
        mimetype: 'audio/wav',
        fileName: 'audio.wav'
      }
    }

    case 'm4a': {
      const outputPath = path.join(workspacePath, 'output.m4a')
      const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'audio',
        mimetype: 'audio/mp4',
        fileName: 'audio.m4a',
        ptt: false
      }
    }

    case 'ogg': {
      const outputPath = path.join(workspacePath, 'output.ogg')
      const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'libvorbis',
        '-q:a', '5',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'audio',
        mimetype: 'audio/ogg',
        fileName: 'audio.ogg',
        ptt: false
      }
    }

    case 'opus': {
      const outputPath = path.join(workspacePath, 'output.opus')
      const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'libopus',
        '-b:a', '64k',
        '-vbr', 'on',
        '-application', 'voip',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'audio',
        mimetype: 'audio/ogg; codecs=opus',
        fileName: 'voice.opus',
        ptt: true
      }
    }

    case 'flac': {
      const outputPath = path.join(workspacePath, 'output.flac')
      const args = [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'flac',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'document',
        mimetype: 'audio/flac',
        fileName: 'audio.flac'
      }
    }

    default:
      throw new Error(`Unhandled audio target format: ${target}`)
  }
}

module.exports = {
  convertAudio,
  SUPPORTED_TARGETS
}
