const { runAsyncProcess } = require('./utils')

/**
 * Runs ffprobe on a file and returns parsed audio/video metadata
 * @param {string} filePath Path to file on disk
 * @returns {Promise<object>} Parsed media metadata
 */
async function probeMedia(filePath) {
  try {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]

    const { stdout } = await runAsyncProcess('ffprobe', args, undefined, 15000)
    const data = JSON.parse(stdout || '{}')

    const streams = data.streams || []
    const format = data.format || {}

    const videoStream = streams.find(s => s.codec_type === 'video' && s.codec_name !== 'png' && s.codec_name !== 'mjpeg') || streams.find(s => s.codec_type === 'video')
    const audioStream = streams.find(s => s.codec_type === 'audio')

    const duration = parseFloat(format.duration || videoStream?.duration || audioStream?.duration || 0)
    const size = parseInt(format.size || 0, 10)
    const bitRate = parseInt(format.bit_rate || 0, 10)

    return {
      success: true,
      formatName: format.format_name || '',
      formatLongName: format.format_long_name || '',
      duration: isNaN(duration) ? null : duration,
      size: isNaN(size) ? null : size,
      bitRate: isNaN(bitRate) ? null : bitRate,
      hasVideo: !!videoStream,
      hasAudio: !!audioStream,
      video: videoStream ? {
        codec: videoStream.codec_name,
        width: videoStream.width,
        height: videoStream.height,
        fps: parseFps(videoStream.r_frame_rate)
      } : null,
      audio: audioStream ? {
        codec: audioStream.codec_name,
        sampleRate: parseInt(audioStream.sample_rate || 0, 10),
        channels: audioStream.channels
      } : null
    }
  } catch (err) {
    // ffprobe might fail on non-multimedia files (e.g. PDF, ZIP, TXT)
    return {
      success: false,
      error: err.message,
      hasVideo: false,
      hasAudio: false
    }
  }
}

function parseFps(fpsString) {
  if (!fpsString) return null
  if (fpsString.includes('/')) {
    const [num, den] = fpsString.split('/').map(Number)
    return den ? Math.round((num / den) * 10) / 10 : null
  }
  return parseFloat(fpsString) || null
}

module.exports = { probeMedia }
