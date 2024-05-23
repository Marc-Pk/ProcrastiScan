// background.js - Background script for the addon
importScripts("lib/browser-polyfill.js"); // remove this line for Firefox

let lastRating = null;
let meanRating = null;
let lastInterventionTime = null;
let lastSentUrl = null;
let addonEnabled;
let popupWindowId = null;
let interventionWindowId = null;
let ws;
let addonInitialized = browser.storage.local.get('addonInitialized') || false;
let user_info = browser.storage.local.get('user_info') || null;
browser.storage.local.set({ websocketConnected: false, llmConnected: "waiting" });

// Function to handle the WebSocket connection
function startWebSocket() {
  ws = new WebSocket('ws://localhost:8765');
  ws.onopen = function() {
    console.log('Websocket started');
    // WebSocket connection is open, now messages can be sent
    ws.send(JSON.stringify({ message: 'requestingConnection' }));
    browser.storage.local.get('addonEnabled').then(result => {
      addonEnabled = result.addonEnabled !== undefined ? result.addonEnabled : true;
    });
    //get initial rating
    browser.storage.local.get(['meanRating', 'lastRating', 'availableInterventions']).then(result => {
      rating = result.lastRating;
      availableInterventions = result.availableInterventions || [];
      updateIconColor(rating, availableInterventions);
    });
  };
  // Listen for messages from the WebSocket server
  ws.onmessage = function(event) {
    const response = JSON.parse(event.data);
    const rating = response.rating;
    const mean_rating = response.mean_rating !== undefined ? response.mean_rating : meanRating;
    const user_info = response.user_info;
    const type = response.type;

    // Update the WebSocket connection status
    if (response.connectionEstablished) {
      browser.storage.local.set({ websocketConnected: true })
      setTimeout(function() {
        ws.send(JSON.stringify({ message: 'getUserInfo' , addonEnabled: addonEnabled}));
      }, 200);
      setTimeout(function() {
        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
          getSimilarityRating(tabs[0]);
        });
      }, 200);
      console.log('Websocket connected');
    }
    // Update the popup fields with the new user info
    if (user_info) {
      // Save the info for the popup script
      browser.storage.local.set({
        task: user_info.task,
        relatedContent: user_info.relatedContent,
        commonDistractions: user_info.commonDistractions
      });
    }

    // Update the LLM connection status
    if (response.testLlm) {
      console.log('LLM test successful');
      browser.storage.local.set({ llmConnected: response.testLlm });
    }

    // Update whether the onboarding has been completed
    if (response.studyInfoSet) {
      console.log('Study info set');
      browser.storage.local.set({ addonInitialized: true });
    }

    // Open the self-report popup
    if (response.SelfReportPopup) {
      openSelfReportPopup();
    }

    // Update the available interventions
    if (response.interventionSchedule) {
      availableInterventions = [response.interventionSchedule[0].interventionType];
      browser.storage.local.set({ interventionSchedule : response.interventionSchedule, availableInterventions: availableInterventions });
    }

    // Update the rating if it concerns the browser
    if (rating && mean_rating && type === 'relevant') {
      browser.storage.local.set({ lastRating: rating, meanRating: mean_rating, currentUrl: lastSentUrl });
      console.log(`Received rating from WebSocket server: ${rating}`);
    }

    // Update keyword suggestions. Currently unused.
    if (response.keywordSuggestions) {
      browser.storage.local.set({ keywordSuggestions: response.keywordSuggestions });
    }

    // Forward LLM messages to the chat script
    if (response.LLMMessage) {
      console.log('Received LLM message:', response.LLMMessage);
      browser.runtime.sendMessage({ type: 'suggestion', suggestion: response.LLMMessage});  
    }

    // Initialize handling of identified distracting tabs
    if (response.distractingIndices) {
      console.log('Received distracting indices');
      handleDistractingTabs(response.distractingIndices).then(() => {
      openInterventionPopup();
      });
    }
    if (response.dashboardData) {
      console.log('Received dashboard data', response.dashboardData);
      browser.runtime.sendMessage({ type: 'dashboardData', data: response.dashboardData });
    }
  };

  ws.onclose = function(){
    browser.storage.local.set({ websocketConnected: false });
    // connection closed, discard old websocket and create a new one in 5s
    console.log('Websocket closed, reconnecting in 5s');
    setTimeout(function() {
      startWebSocket();
    }, 5000);
  };

  // close the websocket if an error occurs to trigger the onclose event
  ws.onerror = function() {
    console.log('Websocket error, closing connection');
    ws.close();
    ws = null;
  }
};

startWebSocket();
  
// Get the similarity rating for the current tab
function getSimilarityRating(tab) {
  const message = {
    url: tab.url,
    title: tab.title,
    user_info: user_info,
    addonEnabled: addonEnabled
  };

  ws.send(JSON.stringify(message));
}


// Listen for tab events (created, updated, switched)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the tab title has changed, the tab is active, and the URL is different from the last sent URL
  if (changeInfo.status === 'complete' && changeInfo.title && tab.active && tab.url !== lastSentUrl) {
    lastSentUrl = tab.url;
    getSimilarityRating(tab);
  }
});

browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId).then((tab) => {
    if (tab && tab.url !== lastSentUrl && tab.status === 'complete') {
      lastSentUrl = tab.url;
      getSimilarityRating(tab);
    }
  });
});

browser.tabs.onCreated.addListener((tab) => {
  // Check if the URL is different from the last sent URL and ensure the tab is fully loaded
  if (tab.url !== lastSentUrl && tab.status === 'complete' && tab.url !== 'about:blank') {
    lastSentUrl = tab.url;
    getSimilarityRating(tab);
  }
});

browser.webNavigation.onCompleted.addListener((details) => {
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0]) {
      // Check if the URL is different from the last sent URL
      if (tabs[0].url !== lastSentUrl) {
        // console.log("onCompleted event received");
        lastSentUrl = tabs[0].url;
        getSimilarityRating(tabs[0]);
      }
    }
  });
});


// Listen for messages from the other scripts
browser.runtime.onMessage.addListener((request) => {
  // Send the self-report data to the WebSocket server
  if (request.type === 'selfReport') {
    console.log('Sending self-report data');
    const selfReport = {
      message: 'selfReport',
      context: 'selfReport',
      isProductiveTime: request.isProductiveTime,
      stressLevel: request.stressLevel,
      distractionLevel: request.distractionLevel
    }
    ws.send(JSON.stringify(selfReport));
    
  }

  // Augment the intervention data with self-report data and send to the WebSocket server
  if (request.type === 'selfReportIntervention') {
    sendSelfReportData(request);
  }

  // Send the lastRating to the popup script
  if (request.type === 'getRating') {
    browser.runtime.sendMessage({ type: 'updateRating', rating: lastRating });
  }

  // force the websocket to reconnect
  if (request.type === 'checkServerStatus') {
    ws.close();
    ws = null;
  }

  // test the LLM connection
  if (request.type === 'testLlm') {
    console.log('Testing LLM');
    ws.send(JSON.stringify({ message: 'testLlm'}));
  }

  // Send the updated user info to the WebSocket server
  if (request.type === 'updateUserInfo') {
    ws.send(JSON.stringify({ message: 'updateUserInfo', user_info: request.user_info }));
  }

  // Send the updated study info to the WebSocket server
  if (request.type === 'updateStudyInfo') {
    //check if the browser.theme API is available
    if (browser.theme) {
      themeIntervention = true;
    }
    else {
      themeIntervention = false;
    }
    ws.send(JSON.stringify({ message: 'updateStudyInfo', study_info: request.study_info, themeIntervention: themeIntervention }));
  }

  // Send a request to the Python script to get keyword suggestions
  if (request.type === 'suggestKeywords') {
    ws.send(JSON.stringify({ message: 'suggestKeywords', task: request.task }));
  }

  // Send a request to the Python script to get relevant content suggestions
  if (request.type === 'suggestRelevantContent') {
    browser.storage.local.get('relatedContent').then(relatedContent => {
    ws.send(JSON.stringify({ message: 'suggestRelevantContent', relatedContent: relatedContent}));
  });
  }

  // Request a LLM response to a message
  if (request.type === 'sendLLMMessage') {
    ws.send(JSON.stringify({ message: 'sendLLMMessage', conversation: request.conversation}));
  }

  // Button for generic development purposes
  if (request.type === 'demoButton') {
    browser.storage.local.set({ chatbotInterventionTriggered: true }).then(() => {
      openInterventionPopup();
    });
  }

  // Send a request to the Python script to identify distracting tabs  
  if (request.type === 'identifyDistractingTabs') {
    identifyDistractingTabs(true); //false to use extension popup
  }

  if (request.type === 'getDashboardData') {
    ws.send(JSON.stringify({ message: 'getDashboardData'}));
  }
});

function sendSelfReportData(request) {
  // Send the self-report data to the server if it exists and remove the temporary storage
  browser.storage.local.get(["listTrackingDataTemp", "chatbotTrackingDataTemp"]).then(result => {
    if (result.listTrackingDataTemp) {
      const listTrackingData = result.listTrackingDataTemp;
      listTrackingData.interventionRating = request.interventionRating || -1;
      listTrackingData.isProductiveTime = request.isProductiveTime || -1;
      console.log('Sending listTrackingData:', listTrackingData);
      ws.send(JSON.stringify({ message: 'listTrackingData', listTrackingData: listTrackingData}));
      browser.storage.local.remove('listTrackingDataTemp');
    }
    else if (result.chatbotTrackingDataTemp) {
      const chatbotTrackingData = result.chatbotTrackingDataTemp;
      chatbotTrackingData.interventionRating = request.interventionRating || -1;
      chatbotTrackingData.isProductiveTime = request.isProductiveTime || -1;
      console.log('Sending chatbotTrackingData:', chatbotTrackingData);
      ws.send(JSON.stringify({ message: 'chatbotTrackingData', chatbotTrackingData: chatbotTrackingData}));
      browser.storage.local.remove('chatbotTrackingDataTemp');
    }
  });
}


// Check which of the open tabs are among those identified as distracting and highlight them
async function handleDistractingTabs(distractingIndices) {
  browser.tabs.query({ currentWindow: true }).then(tabs => {
    // Filter the tabs to get the ones with the provided indices
    const distractingTabs = tabs.filter((tab, index) => distractingIndices.indexOf(index) != -1);
    // Highlight the distracting tabs
    if (distractingTabs.length > 0) {
      const distractingTabIds = distractingTabs.map(tab => tab.id);
      const distractingTabIndices = distractingTabs.map(tab => tab.index);
      browser.tabs.highlight({ tabs: distractingTabIndices, windowId: tabs[0].windowId});
      browser.storage.local.set({ distractingTabs : distractingTabs });
      browser.runtime.sendMessage({ type: 'distractingTabs', distractingTabs: distractingTabs});
    }
  });
}


// Update the icon color and (if applicable) the theme based on the rating
async function updateIconColor(rating, availableInterventions) {
  if (rating === null) {
    rating = 0.5;
  }
  try {
    // generate a canvas element
    // Load the PNG image with transparency
    const img = new Image();
    img.src = 'assets/procrastiscan-icon-inv-128px.png';
    await new Promise(resolve => { img.onload = resolve; });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;

    // Calculate RGB values based on the rating, gray if addon is disabled
    let red, green, blue;
    if (addonEnabled) {
      // Adjust brightness based on rating and clip to (0,1)
      brightness = Math.max(0, Math.min(1, 0.7 - rating));
      
      // Calculate colors
      red = Math.floor(100 + (155 * brightness));
      green = Math.floor(100 - (100 * brightness));
      blue = Math.floor(100 - (100 * brightness));
    } else {
      // Default dark grey
      red = 100;
      green = 100;
      blue = 100;
    }
    
    color = `rgb(${red}, ${green}, ${blue})`;
    ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the icon onto the canvas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    browser.browserAction.setIcon({ imageData: imageData });

    // Update the theme color if the nudging intervention is available
    if (availableInterventions.indexOf("nudging") != -1) {
      browser.theme.update({
        colors: {
          frame: color,
          tab_text: "#ffffff",
          tab_background_text: "#ffffff",
          }
        });
      }
      else {
        browser.theme.reset();
      }
    }
    catch (e) {
    }
}


browser.storage.onChanged.addListener((changes) => {
  browser.storage.local.get(['meanRating', 'lastRating', 'availableInterventions']).then((result) => {
    const availableInterventions = result.availableInterventions || [];
    updateIconColor(result.meanRating, availableInterventions);
  
    if (changes.addonEnabled) {
      addonEnabled = changes.addonEnabled.newValue;
    }
    if (changes.lastInterventionTime) {
      lastInterventionTime = changes.lastInterventionTime.newValue;
    }

    // Trigger intervention popups if the mean rating is below a certain threshold and the last alert was more than 20 minutes ago
    if (changes.lastRating && changes.lastRating.newValue !== null) {
      if (availableInterventions.indexOf("procrastinationList") != -1 || availableInterventions.indexOf("chatbot") != -1) {
      const nMinutes = 20 * 60 * 1000; // 20 minutes in milliseconds
      const newRating = changes.meanRating.newValue;
      const now = Date.now();

      if (newRating < 0.5 && (lastInterventionTime === null || now - lastInterventionTime >= nMinutes)) {    
        browser.storage.local.set({ lastInterventionTime: now });
        if (availableInterventions.indexOf("procrastinationList") != -1) {
          browser.storage.local.set({ listInterventionTriggered: true }).then(() => {
            identifyDistractingTabs(true);
          });
        }
        else if (availableInterventions.indexOf("chatbot") != -1) {
          browser.storage.local.set({ chatbotInterventionTriggered: true }).then(() => {
            openInterventionPopup();
          });
        }
      }
    }
    }
  });
});


// gather titles of all tabs
function identifyDistractingTabs(openInterventionWindow) {
  browser.tabs.query({}).then(tabs => {
    const titles = tabs.map(tab => tab.title);
    const urls = tabs.map(tab => tab.url);
    const indices = tabs.map((tab, index) => index);
    ws.send(JSON.stringify({ message: 'identifyDistractingTabs', titles: titles, urls: urls, indices: indices, openInterventionWindow: openInterventionWindow }));
  });
}


function openInterventionPopup() {
  // Check if the popup window is already open
  if (interventionWindowId !== null) {
    // Focus on the existing popup window
    browser.windows.update(interventionWindowId, { focused: true });
  } else {
    // Open the extension popup in a new browser window
    browser.windows.create({
      type: "popup",
      url: "chat.html",
      width: 800,
      height: 600,
      focused: true
    }).then((window) => {
      interventionWindowId = window.id;
    }).then(() => {
    browser.windows.onFocusChanged.addListener((newWindowId) => {
      if (interventionWindowId !== null) {
        if (newWindowId === interventionWindowId) {
          browser.windows.update(interventionWindowId, { focused: true });
        } else {
          browser.windows.remove(interventionWindowId);
          interventionWindowId = null;
          popupWindowId = null;
          openSelfReportPopup(true);
          browser.windows.onFocusChanged.removeListener();
        }
      }
    });
  });
  }
}


function openSelfReportPopup(intervention) {
  let popupUrl = "self-report.html";
  if (intervention) {
    popupUrl = "self-report-intervention.html";
  }
  if (popupWindowId !== null) {
    browser.windows.update(popupWindowId, { focused: true });
  }
   else {
    browser.windows.create({
      type: "popup",
      url: popupUrl,
      width: 400,
      height: 600,
      focused: true
    }).then((window) => {
      popupWindowId = window.id;
    });
    browser.windows.onFocusChanged.addListener((newWindowId) => {
      if (popupWindowId !== null && newWindowId !== -1) {
        if (newWindowId === popupWindowId) {
          browser.windows.update(popupWindowId, { focused: true });
        } else {
          browser.windows.remove(popupWindowId);
          popupWindowId = null;
          sendSelfReportData({ interventionRating: -1, isProductiveTime: -1 });
          browser.windows.onFocusChanged.removeListener();
        }
      }
    });
  }
}

// Open the welcome dialogue window after installation
browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.get( "addonInitialized" ).then(result => {
    if (!result.addonInitialized) {
      browser.runtime.openOptionsPage()
    }
  })
});

//show the debriefing page
function openStudyFinishedTab() {
  browser.tabs.create({
    url: browser.runtime.getURL("study-finished.html"),
  });
}

// Check if the self-report popup should be opened
function checkSelfReportInterval() {
  browser.storage.local.get('studyFinished').then(result => {
    if (!result.studyFinished) {
      ws.send(JSON.stringify({ message: 'checkSelfReportTiming' }));
      }
  });
}

function checkInterventionSchedule() {
  browser.storage.local.get(['interventionSchedule', 'availableInterventions', 'studyFinished']).then(result => {
    console.log('Checking intervention schedule');

    if (result.interventionSchedule && !result.studyFinished) {
      const currentTime = Date.now();
      const interventionSchedule = result.interventionSchedule;
      const availableInterventions = result.availableInterventions;

      if (availableInterventions[0] === "studyFinished") {

        openStudyFinishedTab();
        browser.storage.local.set({ studyFinished: true });
      }
      // Check if the next intervention is scheduled to start
      const currentInterventionIndex = interventionSchedule.findIndex(item => item.interventionType === availableInterventions[0]);
      const nextIntervention = interventionSchedule[currentInterventionIndex + 1];
      if (nextIntervention) {

        const nextInterventionStartTime = new Date(nextIntervention.startTime).getTime();

        console.log('Current intervention:', availableInterventions[0]);
        console.log('nextIntervention:', nextIntervention.interventionType);
        if (nextInterventionStartTime <= currentTime) {
          
          const updatedInterventions = [nextIntervention.interventionType];
          browser.storage.local.set({ availableInterventions: updatedInterventions });

          // Send a message to the server
          ws.send(JSON.stringify({ message: 'nextInterventionStage', nextIntervention: nextIntervention.interventionType, currentIntervention: availableInterventions[0] }));
        }
      }
    }
  });
}

//automated checks 
setInterval(checkSelfReportInterval, 60 * 1000);
setInterval(checkInterventionSchedule, 60 * 1000);
