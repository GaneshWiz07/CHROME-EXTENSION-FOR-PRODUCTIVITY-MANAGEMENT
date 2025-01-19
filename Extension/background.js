// Track active tabs and their time
let startTime = null;
let currentTabId = null;
let currentDomain = null;
let isTracking = false;

// Initialize or load blocked sites
chrome.storage.local.get(['blockedSites', 'lastStatsReset'], function(result) {
  if (!result.blockedSites) {
    chrome.storage.local.set({ blockedSites: [] });
  } else {
    updateBlockRules(result.blockedSites);
  }
  
  if (!result.lastStatsReset) {
    chrome.storage.local.set({ 
      lastStatsReset: new Date().toISOString(),
      timeStats: {}
    });
  }
});

// Listen for changes to blocked sites
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.blockedSites) {
    updateBlockRules(changes.blockedSites.newValue);
  }
});

async function updateBlockRules(blockedSites) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIds = existingRules.map(rule => rule.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ruleIds
  });

  const rules = blockedSites.map((site, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: chrome.runtime.getURL('blocked.html')
      }
    },
    condition: {
      urlFilter: site,
      resourceTypes: ['main_frame']
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules
  });
}

// Track active tab changes
chrome.tabs.onActivated.addListener(async function(activeInfo) {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  updateTimeTracking(tab);
});

// Track URL changes
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.url) {
    updateTimeTracking(tab);
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(function(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    pauseTracking();
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        updateTimeTracking(tabs[0]);
      }
    });
  }
});

function getDomain(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

function isValidDomain(domain) {
  if (!domain) return false;
  return domain !== 'null' && 
         domain !== 'undefined' && 
         domain !== 'newtab' && 
         !domain.includes('chrome-extension://') &&
         !domain.includes('chrome://') &&
         !domain.includes('edge://') &&
         !domain.includes('about:');
}

function pauseTracking() {
  if (isTracking) {
    updateTime();
    isTracking = false;
  }
  startTime = null;
  currentTabId = null;
  currentDomain = null;
}

function updateTimeTracking(tab) {
  if (!tab || !tab.url) return;

  const domain = getDomain(tab.url);
  if (!isValidDomain(domain)) {
    pauseTracking();
    return;
  }

  // Update time for previous domain before switching
  if (isTracking && currentDomain && currentDomain !== domain) {
    updateTime();
  }

  currentTabId = tab.id;
  currentDomain = domain;
  startTime = Date.now();
  isTracking = true;
}

function updateTime() {
  if (!isTracking || !startTime || !currentDomain || !isValidDomain(currentDomain)) return;

  const endTime = Date.now();
  const timeSpent = endTime - startTime;

  // Only update if time spent is at least 1 second
  if (timeSpent >= 1000) {
    chrome.storage.local.get(['timeStats'], function(result) {
      const timeStats = result.timeStats || {};
      timeStats[currentDomain] = Math.round((timeStats[currentDomain] || 0) + timeSpent);
      chrome.storage.local.set({ timeStats });
    });
  }
}

// Reset stats at midnight
function resetDailyStats() {
  chrome.storage.local.get(['lastStatsReset'], function(result) {
    const now = new Date();
    const lastReset = new Date(result.lastStatsReset || 0);
    
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      chrome.storage.local.set({ 
        timeStats: {},
        lastStatsReset: now.toISOString()
      });
    }
  });
}

// Update time every second and check for daily reset
setInterval(function() {
  if (isTracking) {
    updateTime();
  }
  resetDailyStats();
}, 1000);