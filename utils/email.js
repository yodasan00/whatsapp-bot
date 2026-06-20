const nodemailer = require('nodemailer')

/**
 * Sends an email notification about an error, if SMTP is configured.
 * @param {string} context Descriptive text of where the error occurred
 * @param {Error|any} error The error object or message
 */
async function sendErrorEmail(context, error) {
  // Check if SMTP is configured in .env
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.NOTIFICATION_EMAIL
  ) {
    console.log('[EMAIL] SMTP not fully configured. Skipping error email notification.')
    return
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    const errMsg = error?.message || String(error)
    const errStack = error?.stack || 'No stack trace available'

    const mailOptions = {
      from: `"Yaadobot Alert" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFICATION_EMAIL,
      subject: `🚨 Yaadobot Error: ${context}`,
      text: `Yaadobot encountered an error.\n\nContext: ${context}\nTime: ${new Date().toISOString()}\n\nError Message:\n${errMsg}\n\nStack Trace:\n${errStack}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
          <h2 style="color: #d9534f; margin-top: 0;">🚨 Yaadobot Error Alert</h2>
          <p><strong>Context:</strong> ${context}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <h3 style="color: #333;">Error Message:</h3>
          <pre style="background-color: #fcf8e3; border: 1px solid #faebcc; color: #8a6d3b; padding: 12px; border-radius: 4px; overflow-x: auto; font-family: monospace;">${errMsg}</pre>
          <h3 style="color: #333;">Stack Trace:</h3>
          <pre style="background-color: #f5f5f5; border: 1px solid #ccc; padding: 12px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px;">${errStack}</pre>
        </div>
      `
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('[EMAIL] Error email sent successfully:', info.messageId)
  } catch (err) {
    console.error('[EMAIL] Failed to send error email:', err.message)
  }
}

module.exports = { sendErrorEmail }
