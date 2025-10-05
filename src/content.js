console.log('🚀 ALT-text Generator: CONTENT SCRIPT LOADED!');
console.log('🚀 ALT-text Generator: Current URL:', window.location.href);

const BACKEND_URL = 'http://127.0.0.1:8000';

function log(message) {
    console.log('[ALT-text Generator]:', message);
}

function ensureImageIds() {
    // keep a simple counter on window to avoid collisions between runs
    if (!window.__aiAltIdCounter) window.__aiAltIdCounter = 1;
    const imgs = document.querySelectorAll('img');
    imgs.forEach(img => {
        if (!img.dataset.altId) {
            img.dataset.altId = 'aiimg-' + (window.__aiAltIdCounter++);
        }
    });
}

// Find images missing alt text
function findImagesMissingAlt() {
    // Select images without alt or with empty/whitespace alt
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

        // Check if backend is running
        try {
            const healthCheck = await fetch(`${BACKEND_URL}/health`);
            if (!healthCheck.ok) throw new Error('Backend not responding');
            log('Backend is running');
        } catch (error) {
            log('Backend not available. Please start the Flask server.');
            showNotification('Backend server not running!');
            return;
        }

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            try {
                log(`Processing image ${i + 1}/${images.length}: ${img.src}`);
                
                // Skip data URLs or invalid URLs
                if (!img.src || img.src.startsWith('data:') || img.src.startsWith('blob:')) {
                    log(`⏭Skipping image with unsupported URL: ${img.src}`);
                    continue;
                }
                
                const caption = await generateAltTextFromBackend(img.src);
                
                if (caption) {
                    img.setAttribute('alt', caption);
                    img.setAttribute('title', caption);
                    img.setAttribute('data-ai-generated', 'true'); // mark as AI-generated
                    log(`AI generated: "${caption}"`);
                    
                    // Visual feedback
                    img.style.border = '3px solid #00ff00';
                    img.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.6)';
                    
                    setTimeout(() => {
                        img.style.border = '';
                        img.style.boxShadow = '';
                    }, 2000);
                } else {
                    log(`Failed to generate caption for: ${img.src}`);
                    img.setAttribute('alt', 'Image');
                    img.setAttribute('title', 'Image'); // Fallback hover text
                }
                
                // Small delay between requests to avoid overwhelming backend
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                log(`Error processing image: ${error.message}`);
                img.setAttribute('alt', 'Image');
            }
        }
        
        log('Finished AI processing all images');
        showNotification(`Generated alt text for ${images.length} images!`);
        
    } catch (error) {
        log('Error in AI processing:', error.message);
        showNotification('AI processing failed');
    }
}

async function buildProposals({ onlyMissingAlt = true } = {}) {
    const images = onlyMissingAlt ? findImagesMissingAlt() : Array.from(document.querySelectorAll('img'));
    ensureImageIds();

    // helper: timeout wrapper to avoid blocking the popup
    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
        ]);
    }

    function isAiGenerated(img) {
    if (!img) return false;
    // explicit attribute set when we add alt text
    if (img.getAttribute('data-ai-generated') === 'true') return true;
    // legacy/data-* flag for added records
    if (img.dataset && img.dataset.aiAltAdded === 'true') return true;
    // class-based marker (if you ever add a class)
    if (img.classList && img.classList.contains('ai-generated-image')) return true;
    // small heuristic: title/alt that contains "AI generated" (optional)
    const title = (img.getAttribute('title') || '').toLowerCase();
    if (title.includes('ai generated') || title.includes('ai-generated')) return true;
    return false;
}

    const proposals = [];
for (const img of images) {
    // Skip anything that's not an <img>
    if (!img || img.tagName !== 'IMG') continue;

    // Use helper to check if image was already processed / tagged
    if (isAiGenerated(img)) continue;

    const id = img.dataset.altId;
    const src = img.currentSrc || img.src || '';
    const originalAlt = (img.getAttribute('alt') || '').trim();

    let proposedAlt = originalAlt;
    if (!proposedAlt) {
        try {
            if (typeof withTimeout === 'function') {
                proposedAlt = (await withTimeout(generateAltTextFromBackend(src), 1000)) || '';
            } else {
                proposedAlt = (await generateAltTextFromBackend(src)) || '';
            }
        } catch (e) {
            log(`generateAltTextFromBackend failed for ${src}: ${e.message}`);
            proposedAlt = '';
        }
    }

    if (!originalAlt) {
        proposals.push({ id, src, originalAlt, proposedAlt });
    }
}
return proposals;
}

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return; // ignore unrelated messages

    if (msg.type === 'requestProposals') {
      const onlyMissing = !!msg.onlyMissingAlt;
      buildProposals({ onlyMissingAlt: onlyMissing })
        .then(proposals => sendResponse({ proposals }))
        .catch(err => {
          console.error('[popupBridge] buildProposals error', err);
          sendResponse({ proposals: [] });
        });
      return true; // keep channel open for async response
    }
  });

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


// Find tables that might need horizontal scroll
function findTablesNeedingScroll() {
    const tables = document.querySelectorAll('table');
    const problematicTables = [];
    
    log(`Checking ${tables.length} tables for scroll needs...`);
    
    tables.forEach((table, index) => {
        // Skip if already processed
        if (table.parentElement.classList.contains('scroll-processed-by-extension') ||
            table.parentElement.style.overflowX === 'auto') {
            log(`Table ${index + 1} already processed`);
            return;
        }
        
        const tableWidth = table.scrollWidth;
        const containerWidth = table.parentElement.clientWidth;
        const windowWidth = window.innerWidth;
        
        // Get table column count for additional context
        const firstRow = table.querySelector('tr');
        const columnCount = firstRow ? firstRow.children.length : 0;
        
        log(`Table ${index + 1}:`);
        log(`  - Scroll width: ${tableWidth}px`);
        log(`  - Container width: ${containerWidth}px`);
        log(`  - Window width: ${windowWidth}px`);
        log(`  - Columns: ${columnCount}`);
        
        // More aggressive detection - lower threshold
        const needsScroll = tableWidth > containerWidth + 20 || 
                           tableWidth > windowWidth - 50 || 
                           columnCount >= 5; // Lower threshold
        
        if (needsScroll) {
            problematicTables.push({
                table: table,
                index: index,
                tableWidth: tableWidth,
                containerWidth: containerWidth,
                columnCount: columnCount
            });
            log(`NEEDS SCROLL: ${tableWidth}px > ${containerWidth}px or ${columnCount} columns`);
        } else {
            log(`Fits fine: ${tableWidth}px <= ${containerWidth}px`);
        }
    });
    
    log(`Found ${problematicTables.length} tables that need horizontal scroll`);
    return problematicTables;
}

// Add scroll wrapper to tables
function addScrollToTables(tables) {
    let processedCount = 0;
    
    log(`Processing ${tables.length} tables for scroll wrappers...`);
    
    tables.forEach(({table, index, tableWidth, containerWidth, columnCount}) => {
        try {
            // Skip if already processed
            if (table.classList.contains('scroll-processed-by-extension')) {
                log(`Table ${index + 1} already processed`);
                return;
            }
            
            log(`Processing table ${index + 1}: ${tableWidth}px wide, ${columnCount} columns`);
            
            // Add CSS-only solution - no DOM manipulation as learn doesnt like it
            const styleId = `table-scroll-${index}`;
            
            if (!document.querySelector(`#${styleId}`)) {
                const style = document.createElement('style');
                style.id = styleId;
                
                // Create a unique class for this specific table
                const tableClass = `scrollable-table-${index}`;
                table.classList.add(tableClass);
                
                style.textContent = `
                    .${tableClass} {
                        display: block;
                        overflow-x: auto;
                        overflow-y: visible;
                        white-space: nowrap;
                        -webkit-overflow-scrolling: touch;
                        border: 2px solid #ff6b35;
                        border-radius: 6px;
                        box-shadow: 0 2px 8px rgba(255, 107, 53, 0.15);
                        max-width: 100%;
                    }
                    
                    .${tableClass}::-webkit-scrollbar {
                        height: 10px;
                    }
                    
                    .${tableClass}::-webkit-scrollbar-track {
                        background: #f8f8f8;
                        border-radius: 5px;
                    }
                    
                    .${tableClass}::-webkit-scrollbar-thumb {
                        background: #ff6b35;
                        border-radius: 5px;
                    }
                    
                    .${tableClass}::-webkit-scrollbar-thumb:hover {
                        background: #e55a2b;
                    }
                    
                    .${tableClass} tbody,
                    .${tableClass} thead,
                    .${tableClass} tr,
                    .${tableClass} td,
                    .${tableClass} th {
                        white-space: nowrap;
                    }
                    
                    /* Fade effect to show it's been processed */
                    .${tableClass} {
                        animation: table-highlight 3s ease-in-out;
                    }
                    
                    @keyframes table-highlight {
                        0% { background-color: rgba(255, 107, 53, 0.1); }
                        50% { background-color: rgba(255, 107, 53, 0.05); }
                        100% { background-color: transparent; }
                    }
                    
                    /* Show scroll hint */
                    .${tableClass}::before {
                        content: "📱 Scroll horizontally →";
                        position: absolute;
                        top: -20px;
                        right: 0;
                        background: rgba(255, 107, 53, 0.9);
                        color: white;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 10px;
                        font-weight: bold;
                        z-index: 1000;
                        animation: fade-out-hint 5s ease-in-out forwards;
                        pointer-events: none;
                    }
                    
                    @keyframes fade-out-hint {
                        0% { opacity: 1; }
                        70% { opacity: 1; }
                        100% { opacity: 0; }
                    }
                `;
                
                document.head.appendChild(style);
            }
            
            // Mark as processed without triggering MutationObserver
            table.classList.add('scroll-processed-by-extension');
            
            // Remove the bright border after a few seconds
            setTimeout(() => {
                const existingStyle = document.querySelector(`#table-scroll-${index}`);
                if (existingStyle) {
                    // Update the style to remove the bright border
                    const tableClass = `scrollable-table-${index}`;
                    existingStyle.textContent = existingStyle.textContent.replace(
                        'border: 2px solid #ff6b35;',
                        'border: 1px solid #ddd;'
                    );
                }
            }, 4000);
            
            processedCount++;
            log(`Added CSS-only scroll to table ${index + 1} (${columnCount} columns)`);
            
        } catch (error) {
            log(`Error processing table ${index + 1}: ${error.message}`);
        }
    });
    
    if (processedCount > 0) {
        showNotification(`Made ${processedCount} table(s) scrollable!`);
        log(`Successfully processed ${processedCount} tables with CSS-only approach`);
    } else {
        log(`No tables were processed`);
    }
    
    return processedCount;
}


// Update your main function to include table processing
async function main() {
    log('ALT-text Generator & Table Fixer started');
    
    // Wait for page to settle
    setTimeout(async () => {
        log('Starting to analyze page content...');
        
        // Process images first
        const images = findImagesMissingAlt();
        if (images.length > 0) {
            log(`Processing ${images.length} images for alt text...`);
            await addAIGeneratedAlt(images);
        } else {
            log('No images missing alt text found');
        }
        
        // Then process tables after a short delay
        setTimeout(() => {
            log('Now checking tables...');
            const allTables = document.querySelectorAll('table');
            log(`Found ${allTables.length} total tables on page`);
            
            if (allTables.length > 0) {
                const problematicTables = findTablesNeedingScroll();
                if (problematicTables.length > 0) {
                    log(`Processing ${problematicTables.length} tables that need scroll...`);
                    addScrollToTables(problematicTables);
                } else {
                    log('All tables fit properly - no scroll needed');
                }
            } else {
                log('No tables found on this page');
            }
        }, 2000); // Wait 2 seconds after images
        
    }, 3000); // Wait 3 seconds for page to load
}

// Run when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

