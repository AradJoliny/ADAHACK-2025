console.log('🚀 ALT-text Generator: CONTENT SCRIPT LOADED!');
console.log('🚀 ALT-text Generator: Current URL:', window.location.href);

const BACKEND_URL = 'http://127.0.0.1:8000';

function log(message) {
    console.log('[ALT-text Generator]:', message);
}

// Find images missing alt text
function findImagesMissingAlt() {
    const selector = 'img:not([alt]), img[alt=""], img[alt=" "], img[alt="  "]';
    const images = document.querySelectorAll(selector);
    log(`Found ${images.length} images missing alt text.`);
    return Array.from(images);
}

// Call backend to generate alt text
async function generateAltTextFromBackend(imageUrl) {
    try {
        const response = await fetch(`${BACKEND_URL}/caption`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_url: imageUrl
            })
        });

        const data = await response.json();
        
        if (data.ok) {
            return data.caption;
        } else {
            throw new Error(data.error || 'Backend error');
        }
    } catch (error) {
        log(`Backend error: ${error.message}`);
        return null;
    }
}

// Process images with backend AI
async function addAIGeneratedAlt(images) {
    try {
        log('🤖 Starting AI processing via backend...');
        
        // Check if backend is running
        try {
            const healthCheck = await fetch(`${BACKEND_URL}/health`);
            if (!healthCheck.ok) throw new Error('Backend not responding');
            log('✅ Backend is running');
        } catch (error) {
            log('❌ Backend not available. Please start the Flask server.');
            showNotification('❌ Backend server not running!');
            return;
        }

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            try {
                log(`🔍 Processing image ${i + 1}/${images.length}: ${img.src}`);
                
                // Skip data URLs or invalid URLs
                if (!img.src || img.src.startsWith('data:') || img.src.startsWith('blob:')) {
                    log(`⏭️ Skipping image with unsupported URL: ${img.src}`);
                    continue;
                }
                
                const caption = await generateAltTextFromBackend(img.src);
                
                if (caption) {
                    img.setAttribute('alt', caption);
                    log(`✅ AI generated: "${caption}"`);
                    
                    // Visual feedback
                    img.style.border = '3px solid #00ff00';
                    img.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.6)';
                    
                    setTimeout(() => {
                        img.style.border = '';
                        img.style.boxShadow = '';
                    }, 2000);
                } else {
                    log(`⚠️ Failed to generate caption for: ${img.src}`);
                    img.setAttribute('alt', 'Image');
                }
                
                // Small delay between requests to avoid overwhelming backend
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                log(`❌ Error processing image: ${error.message}`);
                img.setAttribute('alt', 'Image');
            }
        }
        
        log('🎉 Finished AI processing all images');
        showNotification(`🤖 AI generated alt text for ${images.length} images!`);
        
    } catch (error) {
        log('❌ Error in AI processing:', error.message);
        showNotification('❌ AI processing failed');
    }
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        border: 2px solid rgba(255,255,255,0.2);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

// Main function
async function main() {
    log('🚀 ALT-text Generator started');
    
    // Wait for page to settle
    setTimeout(async () => {
        const images = findImagesMissingAlt();
        
        if (images.length > 0) {
            await addAIGeneratedAlt(images);
        } else {
            log('ℹ️ No images missing alt text found');
            showNotification('ℹ️ All images already have alt text!');
        }
    }, 2000);
}

// Run when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}