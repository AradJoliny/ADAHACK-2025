// Background script for ALT-text Generator
console.log('ALT-text Generator background script loaded');

// Optional: Add any background functionality here
chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked on tab:', tab.url);
});