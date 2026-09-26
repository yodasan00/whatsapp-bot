const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { PDFDocument } = require('pdf-lib')

const SUPPORTED_TARGETS = ['jpg', 'jpeg', 'png', 'webp', 'pdf']

/**
 * Converts a single image to the requested format (JPG, PNG, WebP, PDF)
 * @param {string} inputPath Path to source image
 * @param {string} targetFormat Target format extension
 * @param {string} workspacePath Temporary workspace folder
 * @returns {Promise<object>} Result payload
 */
async function convertImage(inputPath, targetFormat, workspacePath) {
  const target = targetFormat.toLowerCase().trim()

  if (!SUPPORTED_TARGETS.includes(target)) {
    throw new Error(`Unsupported image target: "${target}". Supported: ${SUPPORTED_TARGETS.join(', ')}`)
  }

  if (target === 'pdf') {
    const outputPath = path.join(workspacePath, 'document.pdf')
    await createPdfFromImages([inputPath], outputPath)
    return {
      outputPath,
      mediaType: 'document',
      mimetype: 'application/pdf',
      fileName: 'document.pdf'
    }
  }

  switch (target) {
    case 'jpg':
    case 'jpeg': {
      const outputPath = path.join(workspacePath, 'output.jpg')
      await sharp(inputPath)
        .jpeg({ quality: 90 })
        .toFile(outputPath)
      return {
        outputPath,
        mediaType: 'image',
        mimetype: 'image/jpeg',
        caption: '🖼️ Converted to JPEG'
      }
    }

    case 'png': {
      const outputPath = path.join(workspacePath, 'output.png')
      await sharp(inputPath)
        .png({ compressionLevel: 7 })
        .toFile(outputPath)
      return {
        outputPath,
        mediaType: 'image',
        mimetype: 'image/png',
        caption: '🖼️ Converted to PNG'
      }
    }

    case 'webp': {
      const outputPath = path.join(workspacePath, 'output.webp')
      await sharp(inputPath)
        .webp({ quality: 85 })
        .toFile(outputPath)
      return {
        outputPath,
        mediaType: 'image',
        mimetype: 'image/webp',
        caption: '🖼️ Converted to WebP'
      }
    }

    default:
      throw new Error(`Unhandled image target: ${target}`)
  }
}

/**
 * Creates a single multi-page PDF document from one or multiple images
 * @param {string[]} imagePaths Array of file paths to images
 * @param {string} outputPath Target PDF file path
 */
async function createPdfFromImages(imagePaths, outputPath) {
  const pdfDoc = await PDFDocument.create()

  for (const imgPath of imagePaths) {
    // Standardize to JPEG or PNG via sharp to ensure 100% embedding compatibility with pdf-lib
    const metadata = await sharp(imgPath).metadata()
    let imgBuffer
    let isJpg = false

    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      imgBuffer = await fs.promises.readFile(imgPath)
      isJpg = true
    } else {
      // Convert WebP / GIF / HEIC / BMP / PNG to PNG buffer for pdf-lib
      imgBuffer = await sharp(imgPath).png().toBuffer()
      isJpg = false
    }

    const embeddedImage = isJpg
      ? await pdfDoc.embedJpg(imgBuffer)
      : await pdfDoc.embedPng(imgBuffer)

    const imgDims = embeddedImage.scale(1)

    // Standard A4 or fit to image dimension
    const page = pdfDoc.addPage([imgDims.width, imgDims.height])
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: imgDims.width,
      height: imgDims.height
    })
  }

  const pdfBytes = await pdfDoc.save()
  await fs.promises.writeFile(outputPath, pdfBytes)
  return outputPath
}

module.exports = {
  convertImage,
  createPdfFromImages,
  SUPPORTED_TARGETS
}
