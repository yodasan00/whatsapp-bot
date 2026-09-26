const path = require('path')
const fs = require('fs')
const { runAsyncProcess } = require('./utils')

const SUPPORTED_TARGETS = ['mp3', 'm4a', 'opus', 'mp4', 'gif', 'webm', 'jpg', 'png']

/**
 * Converts a video file to the requested target format
 * @param {string} inputPath Path to source video file
 * @param {string} targetFormat Target format extension
 * @param {string} workspacePath Temporary workspace folder
 * @param {object} [metadata] Probed media metadata
 * @returns {Promise<object>} Result payload describing file and WhatsApp message options
 */
async function convertVideo(inputPath, targetFormat, workspacePath, metadata = {}) {
  const target = targetFormat.toLowerCase().trim()

  if (!SUPPORTED_TARGETS.includes(target)) {
    throw new Error(`Unsupported video conversion target: "${target}". Supported: ${SUPPORTED_TARGETS.join(', ')}`)
  }

  // Determine safe seek time for snapshot frames
  const duration = metadata.duration || 1
  const seekTime = Math.min(1, Math.max(0.1, duration / 4))

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

    case 'gif': {
      const outputPath = path.join(workspacePath, 'output.mp4')
      // For WhatsApp, a looping MP4 with gifPlayback flag renders like a native GIF with 10x smaller file size
      const args = [
        '-y',
        '-i', inputPath,
        '-vf', 'fps=15,scale=480:-2:flags=lanczos',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-an',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'video',
        mimetype: 'video/mp4',
        gifPlayback: true,
        caption: '🎞️ Animated GIF'
      }
    }

    case 'webm': {
      const outputPath = path.join(workspacePath, 'output.webm')
      const args = [
        '-y',
        '-i', inputPath,
        '-c:v', 'libvpx-vp9',
        '-crf', '32',
        '-b:v', '0',
        '-c:a', 'libopus',
        '-b:a', '128k',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'document',
        mimetype: 'video/webm',
        fileName: 'video.webm'
      }
    }

    case 'mp4': {
      const outputPath = path.join(workspacePath, 'output.mp4')
      const args = [
        '-y',
        '-i', inputPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'video',
        mimetype: 'video/mp4'
      }
    }

    case 'jpg':
    case 'jpeg': {
      const outputPath = path.join(workspacePath, 'output.jpg')
      const args = [
        '-y',
        '-ss', seekTime.toString(),
        '-i', inputPath,
        '-vframes', '1',
        '-q:v', '2',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'image',
        mimetype: 'image/jpeg',
        caption: '📸 Video Snapshot (JPEG)'
      }
    }

    case 'png': {
      const outputPath = path.join(workspacePath, 'output.png')
      const args = [
        '-y',
        '-ss', seekTime.toString(),
        '-i', inputPath,
        '-vframes', '1',
        outputPath
      ]
      await runAsyncProcess('ffmpeg', args)
      return {
        outputPath,
        mediaType: 'image',
        mimetype: 'image/png',
        caption: '📸 HD Video Snapshot (PNG)'
      }
    }

    default:
      throw new Error(`Unhandled target format: ${target}`)
  }
}

module.exports = {
  convertVideo,
  SUPPORTED_TARGETS
}
