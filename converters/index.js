const { convertVideo, SUPPORTED_TARGETS: VIDEO_TARGETS } = require('./video')
const { convertAudio, SUPPORTED_TARGETS: AUDIO_TARGETS } = require('./audio')
const { convertImage, createPdfFromImages, SUPPORTED_TARGETS: IMAGE_TARGETS } = require('./image')
const { convertPdf, SUPPORTED_TARGETS: PDF_TARGETS } = require('./pdf')
const { convertArchive, SUPPORTED_TARGETS: ARCHIVE_TARGETS } = require('./archive')

const CATEGORIES = {
  video: {
    label: 'Video',
    targets: VIDEO_TARGETS,
    descriptions: {
      mp3: 'Extract MP3 audio track',
      m4a: 'Extract AAC audio track (M4A)',
      opus: 'WhatsApp Voice Note (PTT audio)',
      gif: 'Animated GIF (lightweight preview)',
      webm: 'WebM video format',
      mp4: 'Web-compatible MP4 (H.264 / AAC)',
      jpg: 'Snapshot image frame (JPEG)',
      png: 'HD snapshot image frame (PNG)'
    },
    convert: convertVideo
  },
  audio: {
    label: 'Audio',
    targets: AUDIO_TARGETS,
    descriptions: {
      mp3: 'Standard MP3 audio (192 kbps)',
      wav: 'Uncompressed WAV audio',
      m4a: 'Apple/AAC audio track',
      ogg: 'Ogg Vorbis audio',
      opus: 'WhatsApp Voice Note (PTT audio)',
      flac: 'Lossless FLAC audio'
    },
    convert: convertAudio
  },
  image: {
    label: 'Image',
    targets: ['jpg', 'png', 'webp', 'pdf'],
    descriptions: {
      jpg: 'Standard JPEG image',
      png: 'Lossless PNG image',
      webp: 'Modern WebP image',
      pdf: 'Convert image to PDF document'
    },
    convert: convertImage
  },
  pdf: {
    label: 'PDF Document',
    targets: ['jpg', 'png'],
    descriptions: {
      jpg: 'Extract first page as JPEG',
      png: 'Extract first page as HD PNG'
    },
    convert: convertPdf
  },
  archive: {
    label: 'Archive',
    targets: ['zip', 'extract'],
    descriptions: {
      zip: 'Compress file into a ZIP archive',
      extract: 'Unpack files from this archive'
    },
    convert: convertArchive
  }
}

/**
 * Detects the category of a media file from its MIME, filename, and probe data
 * @param {string} mimetype
 * @param {string} [fileName]
 * @param {object} [probeData]
 * @returns {'video'|'audio'|'image'|'pdf'|'archive'|'unknown'}
 */
function detectCategory(mimetype = '', fileName = '', probeData = {}) {
  const mime = mimetype.toLowerCase()
  const name = fileName.toLowerCase()

  // 1. Probe-based detection if available
  if (probeData.hasVideo && !name.endsWith('.gif')) {
    return 'video'
  }
  if (probeData.hasAudio && !probeData.hasVideo) {
    return 'audio'
  }

  // 2. MIME & Extension checks
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return 'pdf'
  }

  if (mime.includes('zip') || mime.includes('x-tar') || mime.includes('gzip') ||
      name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.gz') || name.endsWith('.rar')) {
    return 'archive'
  }

  if (mime.startsWith('video/') ||
      name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.webm') ||
      name.endsWith('.mov') || name.endsWith('.avi') || name.endsWith('.3gp')) {
    return 'video'
  }

  if (mime.startsWith('audio/') ||
      name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.m4a') ||
      name.endsWith('.ogg') || name.endsWith('.opus') || name.endsWith('.flac') || name.endsWith('.aac')) {
    return 'audio'
  }

  if (mime.startsWith('image/') ||
      name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') ||
      name.endsWith('.webp') || name.endsWith('.gif') || name.endsWith('.bmp') || name.endsWith('.heic')) {
    return 'image'
  }

  return 'unknown'
}

/**
 * Generates an informative formatted menu listing all available conversions for a file
 * @param {string} category
 * @param {object} [info] File information (size, fileName, probeData)
 * @returns {string} Formatted WhatsApp message text
 */
function formatConversionMenu(category, info = {}) {
  const catConfig = CATEGORIES[category]
  if (!catConfig) {
    return '⚠️ *Unsupported file type.* Currently supports Video, Audio, Images, PDFs, and Archives.'
  }

  const sizeFormatted = info.size ? ` (${(info.size / 1024 / 1024).toFixed(1)} MB)` : ''
  const nameFormatted = info.fileName ? ` - _${info.fileName}_` : ''
  let codecDetails = ''
  if (info.probeData) {
    if (info.probeData.video?.codec) codecDetails += ` [${info.probeData.video.codec.toUpperCase()}]`
    if (info.probeData.audio?.codec) codecDetails += ` [${info.probeData.audio.codec.toUpperCase()}]`
  }

  let text = `📁 *File Detected:* ${catConfig.label}${sizeFormatted}${codecDetails}${nameFormatted}\n\n`
  text += `🔄 *Available Conversions:*\n`

  for (const target of catConfig.targets) {
    const desc = catConfig.descriptions[target] || target.toUpperCase()
    text += `• *.convert ${target}* ➔ ${desc}\n`
  }

  // Add ZIP as universal option for files
  if (category !== 'archive') {
    text += `• *.convert zip* ➔ Compress into a .zip archive\n`
  }

  text += `\n💡 _Reply to the file or send caption:_ *.convert <format>*`
  return text
}

module.exports = {
  CATEGORIES,
  detectCategory,
  formatConversionMenu,
  convertVideo,
  convertAudio,
  convertImage,
  convertPdf,
  convertArchive,
  createPdfFromImages
}
