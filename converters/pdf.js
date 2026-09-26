const fs = require('fs')
const path = require('path')
const { runAsyncProcess } = require('./utils')

const SUPPORTED_TARGETS = ['jpg', 'jpeg', 'png']

/**
 * Converts a PDF file into image(s) (Page 1 preview or HD snapshot)
 * @param {string} inputPath Path to source PDF file
 * @param {string} targetFormat 'jpg' | 'png'
 * @param {string} workspacePath Temporary workspace folder
 * @returns {Promise<object>} Result payload
 */
async function convertPdf(inputPath, targetFormat, workspacePath) {
  const target = targetFormat.toLowerCase().trim()

  if (!SUPPORTED_TARGETS.includes(target)) {
    throw new Error(`Unsupported PDF conversion target: "${target}". Supported: ${SUPPORTED_TARGETS.join(', ')}`)
  }

  const isPng = target === 'png'
  const outputPrefix = path.join(workspacePath, 'page')
  const formatFlag = isPng ? '-png' : '-jpeg'

  try {
    // Render first page at 150 DPI (optimal balance of sharpness and low memory)
    const args = [
      formatFlag,
      '-r', '150',
      '-f', '1',
      '-l', '1',
      inputPath,
      outputPrefix
    ]

    await runAsyncProcess('pdftoppm', args)

    // pdftoppm outputs files like page-1.png or page-01.png
    const files = await fs.promises.readdir(workspacePath)
    const ext = isPng ? '.png' : '.jpg'
    const generatedImage = files.find(f => f.startsWith('page') && (f.endsWith(ext) || f.endsWith('.jpeg')))

    if (!generatedImage) {
      throw new Error(`pdftoppm completed but no ${ext} image was produced.`)
    }

    const outputPath = path.join(workspacePath, generatedImage)

    return {
      outputPath,
      mediaType: 'image',
      mimetype: isPng ? 'image/png' : 'image/jpeg',
      caption: `📄 Extracted PDF Page 1 (${isPng ? 'PNG' : 'JPEG'})`
    }
  } catch (err) {
    if (err.message.includes('ENOENT') || err.message.includes('failed to spawn')) {
      throw new Error('Poppler utility (pdftoppm) is not installed on the system. Please ensure poppler-utils is installed.')
    }
    throw err
  }
}

module.exports = {
  convertPdf,
  SUPPORTED_TARGETS
}
