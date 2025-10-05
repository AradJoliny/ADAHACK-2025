// Section 2: Image Detection
function findImagesMissingAlt() {
    const selector = 'img:not([alt]), img[alt=""], img[alt=" "], img[alt="  "]';
    const images = document.querySelectorAll(selector);

    log(`Found ${images.length} images missing alt text.`);
    return images;
}

// Section 3: Generating ALT Text
async function addAIGeneratedAlt(images) {
    // load pretrained model
    const captioner = await window.transformers.pipeline("image-to-text", "Xenova/blip-image-captioning-base");
    
}