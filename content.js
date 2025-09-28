// Create status display element
let statusElement = null;

function createStatusElement() {
  if (statusElement) return;
  
  statusElement = document.createElement('div');
  statusElement.id = 'rrv-status-display';
  statusElement.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 12px 15px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    z-index: 10000;
    max-width: 220px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    backdrop-filter: blur(10px);
  `;
  
  const statusContent = document.createElement('div');
  statusContent.id = 'rrv-status-content';
  statusElement.appendChild(statusContent);
  
  document.body.appendChild(statusElement);
  
  // Add some basic styles to prevent interference
  statusElement.style.pointerEvents = 'none';
}

function updateStatusDisplay(timeLeft, nextRoute) {
  if (!statusElement) {
    createStatusElement();
  }
  
  const statusContent = document.getElementById('rrv-status-content');
  if (!statusContent) return;
  
  if (timeLeft > 0) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    statusContent.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; color: #4CAF50;">✓ Active</div>
      <div>Next visit in: <strong>${minutes}:${seconds.toString().padStart(2, '0')}</strong></div>
      <div style="margin-top: 3px; font-size: 11px; opacity: 0.9;">Next route: ${nextRoute}</div>
    `;
    statusElement.style.display = 'block';
  } else {
    statusContent.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; color: #4CAF50;">✓ Active</div>
      <div>Preparing next visit...</div>
    `;
    statusElement.style.display = 'block';
  }
}

function clearStatusDisplay() {
  if (statusElement) {
    statusElement.style.display = 'none';
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateStatus') {
    updateStatusDisplay(request.timeLeft, request.nextRoute);
  } else if (request.action === 'clearStatus') {
    clearStatusDisplay();
  }
});

// Check if extension is active when page loads
chrome.storage.local.get(['isActive'], function(data) {
  if (data.isActive) {
    // Request current status
    chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
      if (response) {
        updateStatusDisplay(response.timeLeft, response.nextRoute);
      }
    });
  }
});

// Also handle page visibility changes
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    chrome.storage.local.get(['isActive'], function(data) {
      if (data.isActive) {
        chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
          if (response) {
            updateStatusDisplay(response.timeLeft, response.nextRoute);
          }
        });
      }
    });
  }
});