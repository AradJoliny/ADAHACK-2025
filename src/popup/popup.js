let statusEl;
let listEl;

 document.addEventListener('DOMContentLoaded', () =>{
    statusEl = document.getElementById('status');
    listEl = document.getElementById('list');

    // guard: ensure required elements exist
    if (!statusEl || !listEl) {
        console.error('popup: missing #status or #list in popup.html');
        return;
    }

    loadProposals();
});

async function loadProposals() {
  statusEl.textContent = 'Requesting image proposals from page...';
  listEl.innerHTML = '';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    statusEl.textContent = 'No active tab.';
    return;
  }

  // Ask the content script to return proposals
  chrome.tabs.sendMessage(tab.id, { type: 'requestProposals' }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = 'No content script on this page or page blocked responses.';
      return;
    }
    const proposals = response?.proposals || [];
    if (!proposals.length) {
      statusEl.textContent = 'No images found on this page or all images have alt text.';
      return;
    }
    statusEl.textContent = `Found ${proposals.length} image(s).`;
    renderList(proposals);
  });
}

function renderList(proposals) {
  listEl.innerHTML = '';
  proposals.forEach(p => {
    const item = document.createElement('div');
    item.className = 'item';

    const thumb = document.createElement('img');
    thumb.className = 'thumb';
    thumb.src = p.src || '';
    thumb.alt = p.proposedAlt || p.originalAlt || 'image preview';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const proposed = document.createElement('div');
    proposed.className = 'line';
    proposed.textContent = p.proposedAlt || '(proposed alt: none)';

    const original = document.createElement('div');
    original.className = 'sub';
    original.textContent = `original: ${p.originalAlt ? p.originalAlt : '(none)'}`;

    // optional small id/source row
    const small = document.createElement('div');
    small.className = 'small';
    small.textContent = p.src ? truncateUrl(p.src, 60) : p.id || '';

    meta.appendChild(proposed);
    meta.appendChild(original);
    meta.appendChild(small);

    item.appendChild(thumb);
    item.appendChild(meta);

    listEl.appendChild(item);
  });
}

function truncateUrl(url, maxLength = 60) {
  if (!url) return '';
  try {
    const u = new URL(url, window.location.href);
    const compact = u.hostname + u.pathname.replace(/\/+/g, '/');
    if (compact.length <= maxLength) return compact;
    return compact.slice(0, maxLength - 3) + '...';
  } catch (e) {
    // fallback for non-URL strings
    return url.length <= maxLength ? url : url.slice(0, maxLength - 3) + '...';
  }
}