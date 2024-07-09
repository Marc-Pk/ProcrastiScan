// background.js - Background script for the addon
import "./lib/browser-polyfill.js";
import { pipeline, env, cos_sim } from './lib/transformers.min.js';

let interventionWindowId = null;
let ws;

// set the environment for the sentence transformer
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;

const extractor = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2').then(model => {
  return model;
});

//initialize settings
browser.storage.local.get(['settings']).then(result => {

  if (!result.settings) {
    browser.storage.local.set({ settings: { availableInterventions: { nudging: false, procrastinationList: false, chatbot: false }, llmPort: 5000 } });
  }

  browser.storage.local.set({ websocketConnected: false });

}).then(() => {
  embedUserInfo();
});

// Get individual embeddings of text items in an array
async function embedText(texts) {
  const model = await extractor;
  const embeddings = [];
  for (const text of texts) {
    const output = await model(text.toLowerCase(), { pooling: 'mean', normalize: true });
    embeddings.push(output.data);
  }
  return embeddings;
}

// Embed the user info
async function embedUserInfo() {  
  let task, relatedContent, commonDistractions;
  await browser.storage.local.get(['task', 'relatedContent', 'commonDistractions']).then(result => {
    task = [result.task]
    relatedContent = result.relatedContent.split(', ');
    commonDistractions = result.commonDistractions.split(', ');
  });
  
  const embeddingsTask = await embedText(task);
  const embeddingsDistractions = await embedText(commonDistractions);
  const embeddingsRelatedContent = await embedText(relatedContent)
  
  // Convert the embeddings to a serializable format
  function convertEmbeddingsToArray(embeddings) {
    return Array.from(embeddings, emb => Array.from(emb));
  }

  const serializableEmbeddingsTask = convertEmbeddingsToArray(embeddingsTask);
  const serializableEmbeddingsDistractions = convertEmbeddingsToArray(embeddingsDistractions);
  const serializableEmbeddingsRelatedContent = convertEmbeddingsToArray(embeddingsRelatedContent);

  // Save the embeddings to local storage
  await browser.storage.local.set({ embeddingsTask: serializableEmbeddingsTask, embeddingsDistractions: serializableEmbeddingsDistractions, embeddingsRelatedContent: serializableEmbeddingsRelatedContent });
  console.log("Embeddings updated");
}

// Calculate and save the TRS
async function getSimilarityRating({tab, program, save}) {
  let pageInfo, historyName, embeddingsTask, embeddingsRelatedContent, embeddingsDistractions, similarityRatings;
  if (tab) {
    const url = new URL(tab.url);
    pageInfo = {
      title: tab.title,
      url: url.href,
      domain: url.hostname
    };
    historyName = tab.title;
  }
  if (program) {
    pageInfo = {
      title: program.title,
      url: program.name,
      domain: program.name
    };
    historyName = program.title + " - " + program.name;
  }

  if (save) {
    await browser.storage.local.get(['embeddingsTask', 'embeddingsRelatedContent', 'embeddingsDistractions', 'similarityRatings']).then(result => {
      embeddingsTask = result.embeddingsTask;
      embeddingsRelatedContent = result.embeddingsRelatedContent;
      embeddingsDistractions = result.embeddingsDistractions;
      similarityRatings = result.similarityRatings || [];
    });
    
    const currentSimilarityRating = await calculateSimilarity(pageInfo, embeddingsTask, embeddingsRelatedContent, embeddingsDistractions);
    const similarityRatingAvg = await calculateAverageSimilarity(currentSimilarityRating, similarityRatings);
    const newData = { time: Date.now(), trs: currentSimilarityRating, trsAvg: similarityRatingAvg, title: historyName };
    similarityRatings.push(newData);
    browser.storage.local.set({ similarityRatings, lastRating: currentSimilarityRating, meanRating: similarityRatingAvg, currentUrl: pageInfo.url });
    checkInterventions();
    return;
  }

  else {
    await browser.storage.local.get(['embeddingsTask', 'embeddingsRelatedContent', 'embeddingsDistractions']).then(result => {
      embeddingsTask = result.embeddingsTask;
      embeddingsRelatedContent = result.embeddingsRelatedContent;
      embeddingsDistractions = result.embeddingsDistractions;
    });
  
    const currentSimilarityRating = await calculateSimilarity(pageInfo, embeddingsTask, embeddingsRelatedContent, embeddingsDistractions);
    return currentSimilarityRating;
  }
};

// Calculate the current TRS
async function calculateSimilarity(pageInfo, embeddingsTask, embeddingsRelatedContent, embeddingsDistractions) {
  const titleDomain = [`${pageInfo.title.toLowerCase()} ${pageInfo.domain.toLowerCase()}`];
  const embeddingTitleDomainArray = await embedText(titleDomain);
  const embeddingTitleDomain = embeddingTitleDomainArray[0]

  const similarityTask = [];
  const similaritiesDistractions = [];
  const similaritiesRelatedContent = [];

  // Calculate the individual cosine similarities
  for (const embedding of embeddingsTask) {
    similarityTask.push(cos_sim(embedding, embeddingTitleDomain));
  };
  for (const embedding of embeddingsDistractions) {
    similaritiesDistractions.push(cos_sim(embedding, embeddingTitleDomain));
  };  
  for (const embedding of embeddingsRelatedContent) {
    similaritiesRelatedContent.push(cos_sim(embedding, embeddingTitleDomain));
  };

  // Take the highest individual similarity rating for each category
  const similarityWebsiteTask = Math.max(...similarityTask);
  const similarityWebsiteDistractions = Math.max(...similaritiesDistractions);
  const similarityWebsiteRelatedContent = Math.max(...similaritiesRelatedContent);
  
  const similarityRating = ((similarityWebsiteTask + similarityWebsiteRelatedContent - similarityWebsiteDistractions + 1) / 2);

  // round to 3 decimal places
  return Math.round(similarityRating * 1000) / 1000;
}


// Calculate the average TRS
async function calculateAverageSimilarity(currentSimilarityRating, similarityRatings, windowLength = 10) {
  const similarityRatingsTemp = similarityRatings.map(rating => ({ time: rating.time, trs: rating.trs }));
  similarityRatingsTemp.push({ time: Date.now(), trs: currentSimilarityRating });
  const endTime = Date.now();
  const startTime = endTime - windowLength * 60 * 1000; // 10 minutes
  const windowRatings = similarityRatingsTemp.filter(rating => rating.time > startTime && rating.time <= endTime);

  // Sort ratings by time in descending order
  windowRatings.sort((a, b) => b.time - a.time);

  // Check if there are enough entries
  if (windowRatings.length < 2 || (windowRatings.length < 4 && (windowRatings[0].time - windowRatings[1].time) < 15000)) {
    return NaN;
  }
  // time diff between smallest and largest time
  const totalTimeDiff = windowRatings[0].time - windowRatings[windowRatings.length - 1].time;

  // Calculate time differences to the previous data point
  const timeDiffs = windowRatings.map((rating, index) => index > 0 ? rating.time - windowRatings[index - 1].time : 0);
  
  
  const weightedRatings = windowRatings.map((rating, index) => {
    const weight = Math.abs(timeDiffs[index] / totalTimeDiff);
    return { rating: rating.trs, weight};
  });

  // Calculate weighted average
  const weightedSum = weightedRatings.reduce((sum, { rating, weight }) => sum + rating * weight, 0);
  const totalWeight = weightedRatings.reduce((sum, { weight }) => sum + weight, 0);

  const weightedAverage = weightedSum / totalWeight;

  return Math.round(weightedAverage * 1000) / 1000;
}  


// Function to handle the WebSocket connection
function startWebSocket() {
  ws = new WebSocket('ws://localhost:8765');
  ws.onopen = function() {
    console.log('Websocket started');
    ws.send(JSON.stringify({ message: 'requestingConnection' }));
  };
  // Listen for messages from the WebSocket server
  ws.onmessage = function(event) {
    const response = JSON.parse(event.data);

    // Update the WebSocket connection status
    if (response.message == "connectionEstablished") {
      browser.storage.local.set({ websocketConnected: true })
      console.log('Websocket connected');
    }

    // Receive the program info from the WebSocket server
    if (response.programInfo) {
      getSimilarityRating({ program: response.programInfo, save: true });
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

// Listen for tab events (created, updated, switched)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the tab title has changed, the tab is active, and the URL is different from the last sent URL
  if (changeInfo.status === 'complete' && changeInfo.title && tab.active) {
    getSimilarityRating({ tab: tab, save: true });
  }
});

browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId).then((tab) => {
    if (tab && tab.status === 'complete') {
      getSimilarityRating({ tab: tab, save: true });
    }
  });
});

browser.tabs.onCreated.addListener((tab) => {
  if (tab.status === 'complete' && tab.url !== 'about:blank') {
    getSimilarityRating({ tab: tab, save: true });
  }
});

browser.webNavigation.onCompleted.addListener((details) => {
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    getSimilarityRating({ tab: tabs[0], save: true });
  });
});


// Listen for messages from the other scripts
browser.runtime.onMessage.addListener((request) => {
  if (request.type === 'updateUserInfo') {
    embedUserInfo();
  }

  // Button for generic development purposes
  if (request.type === 'demoButton') {
    // Placeholder
  }

  // identify distracting tabs  
  if (request.type === 'identifyDistractingTabs') {
    identifyDistractingTabs(); //false to use extension popup
  }
});


// Check which of the open tabs are among those identified as distracting and highlight them
async function handleDistractingTabs(distractingIndices) {
  const tabs = await browser.tabs.query({ currentWindow: true });
  // Filter the tabs to get the ones with the provided indices
  const distractingTabs = tabs.filter((tab, index) => 
    distractingIndices.some(distracting => distracting.index === tab.id)
  );
  
  // Highlight the distracting tabs
  if (distractingTabs.length > 0) {
    const distractingTabIds = distractingTabs.map(tab => tab.id);
    const distractingTabIndices = distractingTabs.map(tab => tab.index);
    await browser.tabs.highlight({ tabs: distractingTabIndices, windowId: tabs[0].windowId });
    await browser.storage.local.set({ distractingTabs: distractingTabs });
  }
}



// Update the theme based on the rating, if the nudging intervention is available
async function updateIconColor(rating, availableInterventions) {
  if (browser.theme) {
      // Update the theme color if the nudging intervention is available
    if (availableInterventions.nudging == true) {
      if (rating === null) {
        rating = 0.7;
      }

      // // Load the PNG image with transparency
      // const img = new Image();
      // img.src = 'assets/procrastiscan-icon-128px.png';
      // await new Promise(resolve => { img.onload = resolve; });
      
      //   // generate a canvas element
      // const canvas = document.createElement('canvas');
      // const ctx = canvas.getContext('2d');
      // canvas.width = 128;
      // canvas.height = 128;

      // Adjust brightness based on rating and clip to (0,1)
      const brightness = Math.max(0, Math.min(1, 0.7 - rating));
      
      // Calculate colors
      const red = Math.floor(100 + (155 * brightness));
      const green = Math.floor(100 - (100 * brightness));
      const blue = Math.floor(100 - (100 * brightness));

      const color = `rgb(${red}, ${green}, ${blue})`;
      // ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      // ctx.fillRect(0, 0, canvas.width, canvas.height);

      // // Draw the icon onto the canvas
      // ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // browser.action.setIcon({ imageData: imageData });


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
}

// check if the intervention timing has been reached
async function checkInterventions() {
  browser.storage.local.get(['meanRating', 'lastRating', 'settings', 'lastInterventionTime']).then((result) => {
    const availableInterventions = result.settings.availableInterventions || [];
    const lastInterventionTime = result.lastInterventionTime || null;
    updateIconColor(result.meanRating, availableInterventions);

    // Trigger intervention popups if the mean rating is below a certain threshold and the last alert was more than 20 minutes ago
      if (availableInterventions.chatbot == true || availableInterventions.procrastinationList == true) {
      const nMinutes =  20 * 60 * 1000; // 20 minutes in milliseconds
      const now = Date.now();

      if (result.meanRating < 0.5 && (lastInterventionTime === null || now - lastInterventionTime >= nMinutes)) {    
        browser.storage.local.set({ lastInterventionTime: now });
        if (availableInterventions.procrastinationList == true) {
          browser.storage.local.set({ listInterventionTriggered: true }).then(() => {
            identifyDistractingTabs(true);
          });
        }
        else if (availableInterventions.chatbot == true) {
          browser.storage.local.set({ chatbotInterventionTriggered: true }).then(() => {
            openInterventionPopup();
          });
        }
      }
      }
    });
  };


// gather titles of all tabs
function identifyDistractingTabs() {
  browser.tabs.query({}).then(tabs => {
    const distractingIndices = [];

    const promises = tabs.map(tab => {
      return getSimilarityRating({ tab: tab, save: false }).then(score => {
        if (score < 0.5) {
          distractingIndices.push({ index: tab.id });
        }
      });
    });

    Promise.all(promises).then(() => {
      handleDistractingTabs(distractingIndices).then(() => {
        openInterventionPopup();
      });
    });
  });
}


// Open the chat as a popup
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
    // Close the popup window if the user switches to another window
    browser.windows.onFocusChanged.addListener((newWindowId) => {
      if (interventionWindowId !== null) {
        if (newWindowId === interventionWindowId) {
          browser.windows.update(interventionWindowId, { focused: true });
        } else {
          browser.windows.remove(interventionWindowId);
          interventionWindowId = null;
          browser.windows.onFocusChanged.removeListener();
        }
      }
    });
  });
  }
}

// Open the options page after installation
browser.runtime.onInstalled.addListener(() => {
      browser.runtime.openOptionsPage();
});

//keep the service worker alive
setInterval(() => {
  browser.runtime.getPlatformInfo();
}, 1000 * 20);

