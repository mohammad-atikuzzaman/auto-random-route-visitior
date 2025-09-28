let timer = null;
let countdownInterval = null;
let isActive = false;
let timeLeft = 0;
let nextRoute = '';

// Load saved state when extension starts
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['isActive', 'maxTime'], function(data) {
    if (data.isActive) {
      startVisiting();
    }
  });
});

// Also load when extension is installed/updated
chrome.storage.local.get(['isActive', 'maxTime'], function(data) {
  if (data.isActive) {
    startVisiting();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'start') {
    startVisiting();
  } else if (request.action === 'stop') {
    stopVisiting();
  } else if (request.action === 'getStatus') {
    sendResponse({
      timeLeft: timeLeft,
      nextRoute: nextRoute
    });
  }
  return true;
});

function startVisiting() {
  if (isActive) return;
  
  chrome.storage.local.get(['baseUrl', 'routes', 'maxTime'], function(data) {
    if (!data.baseUrl || !data.routes || data.routes.length === 0) {
      console.log('Missing configuration');
      return;
    }
    
    isActive = true;
    scheduleNextVisit(data.baseUrl, data.routes, data.maxTime);
  });
}

function stopVisiting() {
  isActive = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  timeLeft = 0;
  nextRoute = '';
  
  // Notify all tabs to clear status
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, {action: 'clearStatus'});
      } catch (e) {
        // Tab might not have content script loaded yet
      }
    });
  });
}

function getRandomTime(maxTime) {
  // Generate random time between 30 seconds and maxTime
  const minTime = 30; // Minimum 30 seconds
  const randomTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return randomTime;
}

function scheduleNextVisit(baseUrl, routes, maxTime) {
  if (!isActive) return;
  
  // Clear any existing intervals
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  // Select a random route
  const randomIndex = Math.floor(Math.random() * routes.length);
  nextRoute = routes[randomIndex];
  
  // Generate random time between 30 seconds and maxTime
  const randomDelay = getRandomTime(maxTime);
  timeLeft = randomDelay;
  
  console.log(`Next visit in ${timeLeft} seconds to ${nextRoute}`);
  
  // Update status immediately
  updateAllTabs();
  
  // Start countdown timer
  timer = setTimeout(function() {
    if (isActive) {
      visitRoute(baseUrl, nextRoute);
    }
  }, timeLeft * 1000);
  
  // Update countdown every second
  countdownInterval = setInterval(function() {
    if (!isActive) {
      clearInterval(countdownInterval);
      return;
    }
    
    timeLeft--;
    updateAllTabs();
    
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }, 1000);
}

function updateAllTabs() {
  // Update popup
  chrome.runtime.sendMessage({
    action: 'updateCountdown',
    timeLeft: timeLeft,
    nextRoute: nextRoute
  }).catch(() => {}); // Ignore errors if popup is closed
  
  // Update all tabs
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateStatus',
          timeLeft: timeLeft,
          nextRoute: nextRoute
        });
      } catch (e) {
        // Tab might not have content script loaded yet
      }
    });
  });
}

function visitRoute(baseUrl, route) {
  // Ensure the route starts with a slash and clean it
  const formattedRoute = route.startsWith('/') ? route : '/' + route;
  const cleanRoute = formattedRoute.split('?')[0]; // Remove query parameters
  const fullUrl = baseUrl + cleanRoute;
  
  console.log('Visiting:', fullUrl);
  
  // Navigate the active tab to the new URL
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.update(tabs[0].id, {url: fullUrl});
    }
  });
  
  // Schedule next visit after a short delay to allow page load
  setTimeout(() => {
    chrome.storage.local.get(['baseUrl', 'routes', 'maxTime'], function(data) {
      if (isActive && data.baseUrl && data.routes && data.maxTime) {
        scheduleNextVisit(data.baseUrl, data.routes, data.maxTime);
      }
    });
  }, 2000);
}