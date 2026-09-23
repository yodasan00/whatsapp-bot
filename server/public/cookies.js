// Cookie Manager Front-end Logic

const urlParams = new URLSearchParams(window.location.search)
const user = urlParams.get('user')
const token = urlParams.get('token')

// Elements
const userDisplay = document.getElementById('userDisplay')
const healthIndicator = document.getElementById('healthIndicator')
const statusText = document.getElementById('statusText')
const ytCookiesCount = document.getElementById('ytCookiesCount')
const totalCookiesCount = document.getElementById('totalCookiesCount')
const lastUpdated = document.getElementById('lastUpdated')
const testResultBanner = document.getElementById('testResultBanner')
const btnTestCookies = document.getElementById('btnTestCookies')

const dropZone = document.getElementById('dropZone')
const fileInput = document.getElementById('fileInput')
const filePreview = document.getElementById('filePreview')
const previewFileName = document.getElementById('previewFileName')
const previewFileSize = document.getElementById('previewFileSize')
const btnRemoveFile = document.getElementById('btnRemoveFile')

const cookiesTextarea = document.getElementById('cookiesTextarea')
const validationBar = document.getElementById('validationBar')
const validationIcon = document.getElementById('validationIcon')
const validationMessage = document.getElementById('validationMessage')
const btnSaveCookies = document.getElementById('btnSaveCookies')
const toast = document.getElementById('toast')

let currentCookieContent = ''
let activeTab = 'upload'

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!user || !token) {
        showToast('Missing credentials. Please request a new link with .cookies', 'error')
        userDisplay.textContent = 'Unauthorized'
        healthIndicator.className = 'status-indicator error'
        healthIndicator.textContent = 'Unauthorized'
        return
    }

    userDisplay.textContent = user.split('@')[0]
    loadCookieStatus()
    setupEventListeners()
})

// Load Cookie Status from Server
async function loadCookieStatus() {
    healthIndicator.className = 'status-indicator loading'
    healthIndicator.textContent = 'Checking...'

    try {
        const res = await fetch(`/api/cookies/status?user=${encodeURIComponent(user)}&token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (!res.ok) {
            throw new Error(data.error || 'Failed to fetch status')
        }

        if (!data.exists) {
            healthIndicator.className = 'status-indicator error'
            healthIndicator.textContent = 'Missing'
            statusText.textContent = 'Not Installed'
            ytCookiesCount.textContent = '0'
            totalCookiesCount.textContent = '0'
            lastUpdated.textContent = 'Never'
            return
        }

        healthIndicator.className = 'status-indicator healthy'
        healthIndicator.textContent = 'Installed'
        statusText.textContent = 'Installed'
        ytCookiesCount.textContent = data.youtubeCookies || 0
        totalCookiesCount.textContent = data.totalCookies || 0

        if (data.lastModified) {
            const date = new Date(data.lastModified)
            lastUpdated.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    } catch (err) {
        healthIndicator.className = 'status-indicator error'
        healthIndicator.textContent = 'Error'
        statusText.textContent = 'Access Error'
        showToast(err.message, 'error')
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            activeTab = btn.dataset.tab

            document.getElementById('tabUpload').classList.toggle('active', activeTab === 'upload')
            document.getElementById('tabPaste').classList.toggle('active', activeTab === 'paste')
            validateForm()
        })
    })

    // Drag & Drop
    ;['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => {
            e.preventDefault()
            dropZone.classList.add('dragover')
        })
    })

    ;['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => {
            e.preventDefault()
            dropZone.classList.remove('dragover')
        })
    })

    dropZone.addEventListener('drop', e => {
        const files = e.dataTransfer.files
        if (files.length > 0) handleFile(files[0])
    })

    fileInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleFile(e.target.files[0])
    })

    btnRemoveFile.addEventListener('click', () => {
        currentCookieContent = ''
        fileInput.value = ''
        filePreview.classList.add('hidden')
        dropZone.classList.remove('hidden')
        validateForm()
    })

    // Textarea Input
    cookiesTextarea.addEventListener('input', () => {
        currentCookieContent = cookiesTextarea.value
        validateForm()
    })

    // Test Cookies Button
    btnTestCookies.addEventListener('click', runCookieVerification)

    // Save Cookies Button
    btnSaveCookies.addEventListener('click', saveCookies)
}

// Handle file upload
function handleFile(file) {
    if (!file.name.endsWith('.txt')) {
        showToast('Please upload a .txt Netscape cookie file', 'error')
        return
    }

    const reader = new FileReader()
    reader.onload = e => {
        currentCookieContent = e.target.result
        previewFileName.textContent = file.name
        previewFileSize.textContent = (file.size / 1024).toFixed(1) + ' KB'
        filePreview.classList.remove('hidden')
        dropZone.classList.add('hidden')
        validateForm()
    }
    reader.readAsText(file)
}

// Form validation
function validateForm() {
    const text = currentCookieContent.trim()
    const hasLength = text.length > 50
    const hasNetscapeFormat = text.includes('\t') || text.includes('youtube.com') || text.includes('# Netscape')

    if (!hasLength) {
        validationBar.classList.add('hidden')
        btnSaveCookies.disabled = true
        return
    }

    validationBar.classList.remove('hidden')
    if (hasNetscapeFormat) {
        validationIcon.textContent = '✅'
        validationMessage.textContent = 'Valid Netscape format recognized (tab-separated / YouTube domains).'
        validationMessage.style.color = '#a7f3d0'
        btnSaveCookies.disabled = false
    } else {
        validationIcon.textContent = '⚠️'
        validationMessage.textContent = 'Warning: Expected Netscape format (tab-separated cookies).'
        validationMessage.style.color = '#fde68a'
        btnSaveCookies.disabled = false
    }
}

// Run live verification against YouTube
async function runCookieVerification() {
    btnTestCookies.disabled = true
    btnTestCookies.querySelector('.btn-text').textContent = 'Testing connection...'
    testResultBanner.className = 'banner hidden'

    try {
        const res = await fetch('/api/cookies/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, token })
        })

        const data = await res.json()

        if (res.status === 401 || res.status === 403 || data.error?.toLowerCase().includes('unauthorized')) {
            testResultBanner.className = 'banner error'
            testResultBanner.textContent = `🔒 Link Expired: Please type .cookies on WhatsApp to get a fresh 2-hour link.`
            healthIndicator.className = 'status-indicator error'
            healthIndicator.textContent = 'Session Expired'
            showToast('Session expired. Send .cookies on WhatsApp for a new link', 'error')
            return
        }

        if (res.ok && data.valid) {
            testResultBanner.className = 'banner success'
            testResultBanner.textContent = `✅ YouTube connection passed! Verified with video: "${data.videoTitle || 'Active'}"`
            healthIndicator.className = 'status-indicator healthy'
            healthIndicator.textContent = 'Verified'
            showToast('Cookies tested successfully!', 'success')
        } else {
            testResultBanner.className = 'banner error'
            testResultBanner.textContent = `❌ YouTube rejected cookies: ${data.error || 'Cookies expired or flagged'}`
            healthIndicator.className = 'status-indicator error'
            healthIndicator.textContent = 'Flagged'
            showToast('YouTube verification failed.', 'error')
        }
    } catch (err) {
        testResultBanner.className = 'banner error'
        testResultBanner.textContent = `⚠️ Connection error: ${err.message}`
        showToast(err.message, 'error')
    } finally {
        btnTestCookies.disabled = false
        btnTestCookies.querySelector('.btn-text').textContent = 'Test YouTube Connection'
    }
}

// Save cookies to server
async function saveCookies() {
    if (!currentCookieContent) return

    btnSaveCookies.disabled = true
    btnSaveCookies.querySelector('.btn-text').textContent = 'Saving & Verifying...'

    try {
        const res = await fetch('/api/cookies/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user,
                token,
                cookiesContent: currentCookieContent
            })
        })

        const data = await res.json()

        if (!res.ok) {
            throw new Error(data.error || 'Failed to update cookies')
        }

        showToast('✅ Cookies updated successfully!', 'success')

        // If automated verification returned result
        if (data.verification) {
            if (data.verification.valid) {
                testResultBanner.className = 'banner success'
                testResultBanner.textContent = `✅ Newly installed cookies are verified with YouTube!`
            } else if (data.verification.error) {
                testResultBanner.className = 'banner error'
                testResultBanner.textContent = `⚠️ Cookies saved, but YouTube check failed: ${data.verification.error}`
            }
        }

        // Reload status cards
        await loadCookieStatus()

    } catch (err) {
        showToast(err.message, 'error')
    } finally {
        btnSaveCookies.disabled = false
        btnSaveCookies.querySelector('.btn-text').textContent = 'Save & Verify Cookies'
    }
}

// Helper: Toast notification
function showToast(message, type = 'success') {
    toast.textContent = message
    toast.className = `toast ${type}`
    toast.classList.remove('hidden')

    setTimeout(() => {
        toast.classList.add('hidden')
    }, 4000)
}
