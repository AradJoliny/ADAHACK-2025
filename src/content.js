// Section 1: Logging & Setup







// Section 2: Image Detection
function findImagesMissingAlt() {
    // finds images without alt text or with empty alt attributes
    const selector = 'img:not([alt]), img[alt=""], img[alt=" "], img[alt="  "]';
    
    // This finds all <img> elements on the page that match the selector above.
    // Returns a NodeList of those elements.
    const images = document.querySelectorAll(selector);

    // calls logging function to log how many images were found
    log(`Found ${images.length} images missing alt text.`);

    // returns the NodeList of images
    return images;

    
}

// Section 3: Generating ALT Text
function log(message) {
    console.log('[ALT-text Generator]:', message);
}

async function addAIGeneratedAlt(images) {
    try {

        
        // wait for transformers library to load/be available
        if (typeof transformers === 'undefined') {
            log('Waiting for transformers library to load...');
            await new Promise(resolve => {
                const checkTransformers = () => {
                    if (typeof transformers !== 'undefined') {
                        resolve();
                } else {
                    setTimeout(checkTransformers, 100);
                }
            };
            checkTransformers();
        });
    }
        log('Loading AI model...');
        const captioner = await transformers.pipeline('image-to-text', 'Xenova/all-mini-image-captioning');

        for (let img of images) {
            try {
                log(`Generating alt text for image: ${img.src}`);
                const result = await captioner(img.src);
                const altText = result[0].generated_text;

                img.setAttribute('alt', altText);
                log(`Added alt text: "${altText}"`);
            } catch (error) {
                log(`Error generating alt text for image ${img.src}: ${error}`);
            }
        } 
    } catch (error) {
            log('Error loading AI model:', error);
        }
    }

// Main function
async function main() {
    log('ALT-text Generator started');
    const images = findImagesMissingAlt();
    
    if (images.length > 0) {
        await addAIGeneratedAlt(images);
        log('Finished processing images');
    } else {
        log('No images missing alt text found');
    }
}

// Run when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}