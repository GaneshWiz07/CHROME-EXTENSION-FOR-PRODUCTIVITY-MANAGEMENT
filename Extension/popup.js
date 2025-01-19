document.addEventListener('DOMContentLoaded', function() {
  const siteInput = document.getElementById('siteInput');
  const addSiteButton = document.getElementById('addSite');
  const blockedSitesList = document.getElementById('blockedSites');
  const timeStats = document.getElementById('timeStats');

  // Load blocked sites and display them
  chrome.storage.local.get(['blockedSites'], function(result) {
    const blockedSites = result.blockedSites || [];
    displayBlockedSites(blockedSites);
  });

  // Load and display time statistics
  updateTimeStats();

  // Add new site to block
  addSiteButton.addEventListener('click', function() {
    const site = siteInput.value.trim().toLowerCase();
    if (site) {
      chrome.storage.local.get(['blockedSites'], function(result) {
        const blockedSites = result.blockedSites || [];
        if (!blockedSites.includes(site)) {
          blockedSites.push(site);
          chrome.storage.local.set({ blockedSites }, function() {
            displayBlockedSites(blockedSites);
            siteInput.value = '';
          });
        }
      });
    }
  });

  function displayBlockedSites(sites) {
    blockedSitesList.innerHTML = '';
    sites.forEach(site => {
      const li = document.createElement('li');
      li.className = 'site-item';
      li.innerHTML = `
        <span>${site}</span>
        <button class="remove-site" data-site="${site}">Remove</button>
      `;
      blockedSitesList.appendChild(li);
    });

    // Add remove button listeners
    document.querySelectorAll('.remove-site').forEach(button => {
      button.addEventListener('click', function() {
        const siteToRemove = this.getAttribute('data-site');
        chrome.storage.local.get(['blockedSites'], function(result) {
          const blockedSites = result.blockedSites.filter(site => site !== siteToRemove);
          chrome.storage.local.set({ blockedSites }, function() {
            displayBlockedSites(blockedSites);
          });
        });
      });
    });
  }

  function formatTime(milliseconds) {
    const totalSeconds = Math.round(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  function updateTimeStats() {
    chrome.storage.local.get(['timeStats'], function(result) {
      const stats = result.timeStats || {};
      let statsHtml = '<ul style="list-style: none; padding: 0;">';
      
      Object.entries(stats)
        .filter(([domain]) => domain && domain !== 'null' && domain !== 'undefined')
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([domain, time]) => {
          const formattedTime = formatTime(time);
          statsHtml += `<li style="margin-bottom: 5px;">
            ${domain}: ${formattedTime}
          </li>`;
        });
      
      statsHtml += '</ul>';
      timeStats.innerHTML = statsHtml;
    });
  }

  // Update stats every second
  setInterval(updateTimeStats, 1000);
});