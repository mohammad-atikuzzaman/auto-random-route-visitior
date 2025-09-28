document.addEventListener('DOMContentLoaded', function() {
  const baseUrlInput = document.getElementById('baseUrl');
  const routesTextarea = document.getElementById('routes');
  const maxTimeRange = document.getElementById('maxTimeRange');
  const maxTimeValue = document.getElementById('maxTimeValue');
  const maxTimeDisplay = document.getElementById('maxTimeDisplay');
  const toggleBtn = document.getElementById('toggleBtn');
  const statusDiv = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const countdownDiv = document.getElementById('countdown');
  const nextRouteDiv = document.getElementById('nextRoute');

  // Update max time value display
  maxTimeRange.addEventListener('input', function() {
    maxTimeValue.textContent = this.value;
    maxTimeDisplay.textContent = this.value;
  });

  // Load saved settings
  chrome.storage.local.get(['baseUrl', 'routes', 'maxTime', 'isActive'], function(data) {
    if (data.baseUrl) baseUrlInput.value = data.baseUrl;
    if (data.routes) routesTextarea.value = data.routes.join('\n');
    if (data.maxTime) {
      maxTimeRange.value = data.maxTime;
      maxTimeValue.textContent = data.maxTime;
      maxTimeDisplay.textContent = data.maxTime;
    }
    
    updateStatus(data.isActive);
  });

  // Get current tab URL if available
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url) {
      try {
        const url = new URL(tabs[0].url);
        if (!baseUrlInput.value) {
          baseUrlInput.value = `${url.protocol}//${url.hostname}`;
        }
      } catch (e) {
        console.log('Could not parse current URL');
      }
    }
  });

  // Toggle button click handler
  toggleBtn.addEventListener('click', function() {
    chrome.storage.local.get(['isActive'], function(data) {
      const newActiveState = !data.isActive;
      
      if (newActiveState) {
        // Validate inputs before starting
        let baseUrl = baseUrlInput.value.trim();
        const routes = routesTextarea.value.split('\n')
          .map(route => route.trim())
          .filter(route => route.length > 0);
        
        // If no base URL provided, try to get current tab's URL
        if (!baseUrl) {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0] && tabs[0].url) {
              try {
                const url = new URL(tabs[0].url);
                baseUrl = `${url.protocol}//${url.hostname}`;
                baseUrlInput.value = baseUrl;
                startVisiting(baseUrl, routes);
              } catch (e) {
                alert('Please enter a valid base URL');
              }
            } else {
              alert('Please enter a base URL');
            }
          });
        } else {
          startVisiting(baseUrl, routes);
        }
      } else {
        // Stop
        chrome.storage.local.set({isActive: false}, function() {
          updateStatus(false);
          chrome.runtime.sendMessage({action: 'stop'});
        });
      }
    });
  });

  function startVisiting(baseUrl, routes) {
    if (routes.length === 0) {
      alert('Please enter at least one route');
      return;
    }
    
    // Save settings and start
    chrome.storage.local.set({
      baseUrl: baseUrl,
      routes: routes,
      maxTime: parseInt(maxTimeRange.value),
      isActive: true
    }, function() {
      updateStatus(true);
      chrome.runtime.sendMessage({action: 'start'});
    });
  }

  // Update status display
  function updateStatus(isActive) {
    if (isActive) {
      statusText.textContent = 'Active';
      statusDiv.className = 'status active';
      toggleBtn.textContent = 'Stop Visiting';
      toggleBtn.style.backgroundColor = '#f44336';
      
      // Request current status from background script
      chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
        if (response) {
          updateCountdown(response.timeLeft, response.nextRoute);
        }
      });
    } else {
      statusText.textContent = 'Inactive';
      statusDiv.className = 'status inactive';
      toggleBtn.textContent = 'Start Visiting';
      toggleBtn.style.backgroundColor = '#4CAF50';
      countdownDiv.textContent = '';
      nextRouteDiv.textContent = '';
    }
  }

  // Update countdown display
  function updateCountdown(timeLeft, nextRoute) {
    if (timeLeft > 0) {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      countdownDiv.textContent = `Next visit in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      if (nextRoute) {
        nextRouteDiv.textContent = `Next route: ${nextRoute}`;
      }
    } else {
      countdownDiv.textContent = 'Preparing next visit...';
      nextRouteDiv.textContent = '';
    }
  }

  // Listen for countdown updates from background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateCountdown') {
      updateCountdown(request.timeLeft, request.nextRoute);
    }
  });
});