const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const AdmZip = require('adm-zip')

const SUPPORTED_TARGETS = ['zip', 'extract', 'unzip']

/**
 * Creates a ZIP archive containing the provided file(s)
 * @param {string[]} filePaths Array of file paths to pack
 * @param {string} outputPath Target ZIP file path
 * @returns {Promise<string>} Output ZIP path
 */
function createZipArchive(filePaths, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: 6 }
    })

    output.on('close', () => resolve(outputPath))
    archive.on('error', reject)
    output.on('error', reject)

    archive.pipe(output)

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath)
      archive.file(filePath, { name: fileName })
    }

    archive.finalize()
  })
}

/**
 * Extracts a ZIP archive and returns file list and contents
 * @param {string} zipPath Path to ZIP file
 * @param {string} extractDir Target extraction directory
 * @returns {Promise<{ files: string[], summary: string }>}
 */
async function extractZipArchive(zipPath, extractDir) {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()

  if (entries.length === 0) {
    throw new Error('ZIP archive is empty.')
  }

  // Security check: Zip Slip vulnerability prevention
  for (const entry of entries) {
    const normalized = path.normalize(entry.entryName)
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new Error('Security Error: Malicious archive structure detected.')
    }
  }

  zip.extractAllTo(extractDir, true)

  const extractedFiles = []
  function scan(dir) {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      const full = path.join(dir, item)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        scan(full)
      } else {
        extractedFiles.push(full)
      }
    }
  }
  scan(extractDir)

  const fileList = entries
    .filter(e => !e.isDirectory)
    .map(e => `• ${e.entryName} (${(e.header.size / 1024).toFixed(1)} KB)`)
    .slice(0, 15)
    .join('\n')

  return {
    files: extractedFiles,
    summary: fileList + (entries.length > 15 ? `\n...and ${entries.length - 15} more files` : '')
  }
}

/**
 * Handles archive conversion request
 * @param {string} inputPath Source file
 * @param {string} targetFormat 'zip' | 'extract' | 'unzip'
 * @param {string} workspacePath Temporary folder
 * @param {string} [originalName] Original file name
 * @returns {Promise<object>}
 */
async function convertArchive(inputPath, targetFormat, workspacePath, originalName = 'file') {
  const target = targetFormat.toLowerCase().trim()

  if (target === 'zip') {
    const base = path.basename(originalName, path.extname(originalName))
    const outputPath = path.join(workspacePath, `${base}.zip`)
    await createZipArchive([inputPath], outputPath)
    return {
      outputPath,
      mediaType: 'document',
      mimetype: 'application/zip',
      fileName: `${base}.zip`,
      caption: `📦 Created ZIP archive: ${base}.zip`
    }
  }

  if (target === 'extract' || target === 'unzip') {
    const extractDir = path.join(workspacePath, 'extracted')
    fs.mkdirSync(extractDir, { recursive: true })
    const { files, summary } = await extractZipArchive(inputPath, extractDir)

    // If exactly 1 file extracted, send that file directly
    if (files.length === 1) {
      const singleFile = files[0]
      const ext = path.extname(singleFile).toLowerCase()
      const isImg = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
      const isAudio = ['.mp3', '.m4a', '.ogg', '.wav'].includes(ext)
      const isVideo = ['.mp4', '.mkv', '.webm'].includes(ext)

      let mediaType = 'document'
      if (isImg) mediaType = 'image'
      else if (isAudio) mediaType = 'audio'
      else if (isVideo) mediaType = 'video'

      return {
        outputPath: singleFile,
        mediaType,
        fileName: path.basename(singleFile),
        caption: `📂 Extracted: ${path.basename(singleFile)}`
      }
    }

    // If multiple files, pack them or send summary
    return {
      files,
      summary,
      extractDir
    }
  }

  throw new Error(`Unsupported archive target: ${target}`)
}

module.exports = {
  createZipArchive,
  extractZipArchive,
  convertArchive,
  SUPPORTED_TARGETS
}
