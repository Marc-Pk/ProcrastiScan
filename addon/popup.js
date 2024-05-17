// popup.js - popup to display user info settings, display similarity rating and provide user interaction

let keywordSuggestionsReceived = false;

// Listen for messages from background.js
browser.runtime.onMessage.addListener(request => {

  // update the popup UI with the user info
  if (request.type === 'updateUserInfo') {
    const { task, relatedContent, commonDistractions } = request.user_info;
    browser.storage.local.set({
      task: task,
      relatedContent: relatedContent,
      commonDistractions: commonDistractions,
    });
  }
  if (request.type === 'distractingTabs') {
    //window.location.href = 'chat.html';
  }
});

// Get the title of the current tab
async function getCurrentTabTitle() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length > 0 ? tabs[0].title : null;
}

async function getCurrentTabUrl() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length > 0 ? tabs[0].url : null;
}

// Update the elements in the popup UI
function updatePopupUI() {
  if (keywordSuggestionsReceived) {
    return; // Exit early, don't update UI so that the keyword suggestions are not overwritten
  }
  browser.storage.local.get(['task', 'relatedContent', 'commonDistractions', 'lastRating', 'meanRating', 'currentUrl', 'addonEnabled']).then(result => {
    getCurrentTabUrl().then(currentTabUrl => {
      const task = result.task || '';
      const relatedContent = result.relatedContent || '';
      const commonDistractions = result.commonDistractions || '';
      const lastRating = result.lastRating || 'Loading...';
      const meanRating = result.meanRating || 'Loading...';
      const addonEnabled = result.addonEnabled !== undefined ? result.addonEnabled : true;

      const currentTabTitleElement = document.getElementById('currentTitle');
      const redDotElement = document.getElementById('redDot');
      const greenDotElement = document.getElementById('greenDot');
      const taskElement = document.getElementById('task');
      const relatedContentElement = document.getElementById('relatedContent');
      const commonDistractionsElement = document.getElementById('commonDistractions');
      const lastRatingElement = document.getElementById('lastRating');
      const meanRatingElement = document.getElementById('meanRating');
      const similarityRatingHeader = document.getElementById('similarityRatingHeader');

      taskElement.value = task;
      relatedContentElement.value = relatedContent;
      commonDistractionsElement.value = commonDistractions;
    

    // Toggle indicator color based on current tab URL
    if (addonEnabled) {
      if (currentTabUrl === result.currentUrl) {
        redDotElement.style.display = 'none';
        greenDotElement.style.display = 'inline';
        getCurrentTabTitle().then(title => {
          currentTabTitleElement.textContent = title;
        });
      } else {
        redDotElement.style.display = 'inline';
        greenDotElement.style.display = 'none';
        currentTabTitleElement.textContent = 'Loading...';
      }

      lastRatingElement.textContent = lastRating;
      meanRatingElement.textContent = meanRating;
      similarityRatingHeader.classList.remove('disabled');
    } else {
      // Addon is disabled
      redDotElement.style.display = 'none';
      greenDotElement.style.display = 'none';
      currentTabTitleElement.textContent = 'Addon is currently disabled';
      lastRatingElement.textContent = '';
      meanRatingElement.textContent = '';
      relatedContentElement.style.color = 'gray';
      similarityRatingHeader.classList.add('disabled');
    }
  });
});
}

document.addEventListener('DOMContentLoaded', () => {
  // Update UI when popup is opened unless keyword suggestions have been received
  if (!keywordSuggestionsReceived) {
    updatePopupUI();
  }

  // Save settings button event listener
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    // get the user info from the popup and trim any trailing non-alphanumeric characters
    const user_info = {
      task: document.getElementById('task').value.trim().replace(/[^\w\s]+$/, ''),
      relatedContent: document.getElementById('relatedContent').value.trim().replace(/[^\w\s]+$/, ''),
      commonDistractions: document.getElementById('commonDistractions').value.trim().replace(/[^\w\s]+$/, '')
    };
    browser.runtime.sendMessage({ type: 'updateUserInfo', user_info });
    browser.storage.local.set(user_info);
    console.log('Settings saved!');
  });

  // Suggest keywords button event listener. Currently unused.
  document.getElementById('suggestKeywordsBtn').addEventListener('click', () => {
    const task = document.getElementById('task').value;
    browser.runtime.sendMessage({ type: 'suggestKeywords', task: document.getElementById('task').value});
  });

  // Listen for changes to keywordSuggestions in storage. Currently unused.
  browser.storage.onChanged.addListener(changes => {
    if (changes.keywordSuggestions) {
      keywordSuggestionsReceived = true;
        const keywordSuggestions = changes.keywordSuggestions.newValue;
        console.log('Received keyword suggestions:', keywordSuggestions);
        if (keywordSuggestions && keywordSuggestions.length > 0) {
          const relatedContentElement = document.getElementById('relatedContent');
          relatedContentElement.style.color = 'blue';
          relatedContentElement.value = keywordSuggestions;
        }
      }
    else {
      updatePopupUI();
    }
    });

  // Retrieve addonEnabled value from storage and set checkbox state
  browser.storage.local.get('addonEnabled').then(result => {
    const addonEnabledCheckbox = document.getElementById('addonEnabled');
    addonEnabledCheckbox.checked = result.addonEnabled !== undefined ? result.addonEnabled : true;
  }).catch(error => {
    console.error('Error retrieving addonEnabled from storage:', error);
  });

  //save the addon switch state
  document.getElementById('addonEnabled').addEventListener('change', (event) => {
    browser.storage.local.set({ addonEnabled: event.target.checked });
  });
  
  // manually trigger the distracting tabs identification
  document.getElementById('identifyDistractingTabsBtn').addEventListener('click', e => {
    e.preventDefault();
    browser.storage.local.set({ listInterventionTriggered: false }).then(() => {
      browser.runtime.sendMessage({ type: 'identifyDistractingTabs' });
    });
  });

  // Development button for arbitrary action
  document.getElementById('demoContentBtn').addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'demoButton' });
  });
});
