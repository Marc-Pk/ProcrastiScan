// chat.js - llm interaction
browser.runtime.onMessage.addListener(request => {
  if (request.type === 'suggestion') {
    replacePlaceholder(request.suggestion);
    // Enable send button after response is received
    enableSendButton();
  }
});


document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('chat-container') !== null) {
    initializeTrackingData().then(() => {
      loadConversation();
      setEventListeners();
    });
  }

});


// Replace the placeholder message with the actual suggestion
function replacePlaceholder(suggestion) {
  getConversation().then(conversation => {
    const placeholderIndex = findPlaceholderIndex(conversation);
    if (placeholderIndex !== -1) {
      conversation[placeholderIndex].message = suggestion;
      storeConversation(conversation).then(() => {
        loadConversation();
      });
    }
  });
}

// Find index of the placeholder message
function findPlaceholderIndex(conversation) {
  return conversation.findIndex((msg, index) => msg.sender === 'Assistant' && msg.message === '...' && index === conversation.length - 1);
}

// Set event listeners for UI buttons
function setEventListeners() {

  document.getElementById('clear-conversation').addEventListener('click', e => {
    e.preventDefault();
    clearConversation();
  });

  document.getElementById('clear-last-message').addEventListener('click', e => {
    e.preventDefault();
    clearLastMessage();
  });

  document.getElementById('sendMessageBtn').addEventListener('click', e => {
    e.preventDefault();
    sendMessage();
  });

  document.getElementById('interveneBasicPromptBtn').addEventListener('click', e => {
    e.preventDefault();
    interveneBasicPrompt();
  });
};

// Send user message
function sendMessage() {
  const inputField = document.getElementById('chat-message');
  const message = inputField.value.trim();
  
  disableSendButton();
  storeMessageInConversation('User', message).then(conversation => {
    sendConversationToBackgroundScript(conversation);
  });
  inputField.value = '';
  loadConversation();
}

// Intervene with a basic prompt
function interveneBasicPrompt() {
  // Fetch variables from storage
  browser.storage.local.get(['task', 'relatedContent']).then(({ task, relatedContent }) => {
    const message = `Hey, I'm currently procrastinating on the following task: ${task}. Here are some examples of what kinds of content might be relevant to my task: ${relatedContent}. Could you help me get back on track?`;

    storeMessageInConversation('User', message).then(conversation => {
      sendConversationToBackgroundScript(conversation);
    });
  });
}

// Removes the last message from the conversation
function clearLastMessage() {
  getConversation().then(conversation => {
    if (conversation.length > 0) {
      conversation.pop(); // Remove the last message
      storeConversation(conversation).then(loadConversation);
    }
  });
}

// Clear conversation
function clearConversation() {
  browser.storage.local.remove('conversation').then(loadConversation);
}

// Store a message in the conversation
function storeMessageInConversation(sender, message, addPlaceholder = true) {
  return getConversation().then(conversation => {
    if (addPlaceholder) {
      // Check if the last message is the placeholder
      const lastMessage = conversation[conversation.length - 1];
      if (lastMessage && lastMessage.sender === 'Assistant' && lastMessage.message === '...') {
        // Replace the placeholder with the user's new message
        conversation.pop();
        conversation.push({ sender, message });
      } else {
        // Add the user's message and a new placeholder
        conversation.push({ sender, message });
        conversation.push({ sender: 'Assistant', message: '...' });
      }
    }
    else {
      // Only add the user's message
      conversation.push({ sender, message });
    }
    storeConversation(conversation)
    return conversation;
  });
}

// Load conversation from storage
function loadConversation() {

  // Check intervention queue
  browser.storage.local.get(['distractingTabs', 'chatbotInterventionTriggered']).then(({ distractingTabs, chatbotInterventionTriggered }) => {
    if (distractingTabs) {
      disableSendButton();
      const message = `It looks like you have some distracting tabs open:<br><br>${distractingTabs.map(tab => `- ${tab.title} (${tab.url})`).join('<br>')}<br><br>What would you like to do with them?`;
      return storeMessageInConversation('Assistant', message, false);
    }
    if (chatbotInterventionTriggered) {
      const message = `It looks like you're procrastinating. Would you like me to help you get back on track?`;
      return storeMessageInConversation('Assistant', message, false);
    }
    return Promise.resolve();
  })
  // Get conversation from storage and render it
  .then(() => getConversation())
  .then(conversation => {
    renderConversation(conversation);

    // Handle distracting tabs if they exist and show interactive buttons
    browser.storage.local.get(['distractingTabs', 'chatbotInterventionTriggered']).then(({ distractingTabs, chatbotInterventionTriggered }) => {
      if (distractingTabs) {
        const chatContainer = document.getElementById('chat-container');
        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('actions-container');

        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('button-container');

        // Define handleButtonAction as a function
        function handleButtonAction(action, distractingTabs) {
          return () => {
            // Store the button action name as a user message
            browser.storage.local.get(['listTrackingData', 'distractingEntries']).then(data => {
              if (!data.distractingEntries) {
                data.distractingEntries = [];
              }
              const listTrackingData = data.listTrackingData;
              listTrackingData.nTabsInList = data.distractingEntries.length || 0;
              storeMessageInConversation('User', action, false).then(() => {
                // Perform action based on the button clicked
                switch (action) {
                  case 'Close Tabs':
                    listTrackingData.optionChosen = 'Close Tabs';
                    listTrackingData.nTabsClosed = distractingTabs.length;
                    closeDistractingTabs(distractingTabs);
                    break;
                  case 'Save Tabs to Procrastination List':
                    listTrackingData.optionChosen = 'Save Tabs to Procrastination List';
                    listTrackingData.nTabsToList = distractingTabs.length;
                    saveDistractingTabs(distractingTabs);
                    break;
                  case 'Save and Close Tabs':
                    listTrackingData.optionChosen = 'Save and Close Tabs';
                    listTrackingData.nTabsToList = distractingTabs.length;
                    listTrackingData.nTabsClosed = distractingTabs.length;
                    saveDistractingTabs(distractingTabs);
                    closeDistractingTabs(distractingTabs);
                    break;
                  case 'Do Nothing':
                    listTrackingData.optionChosen = 'Do Nothing';
                    break;
                  default:
                    break;
                }
                browser.storage.local.set({ listTrackingData }).then(() => {
                  // Remove the distractingTabs variable and re-enable send button
                  browser.storage.local.remove('distractingTabs').then(() => {
                    enableSendButton();
                    loadConversation();
                  });
              });
            });
          });
        };
      }

      const closeTabsButton = document.createElement('button');
      closeTabsButton.textContent = 'Close Tabs';
      closeTabsButton.classList.add('btn', 'btn-primary');
      closeTabsButton.addEventListener('click', handleButtonAction('Close Tabs', distractingTabs));
      buttonsContainer.appendChild(closeTabsButton);

      const saveTabsButton = document.createElement('button');
      saveTabsButton.textContent = 'Save Tabs to Procrastination List';
      saveTabsButton.classList.add('btn', 'btn-primary');
      saveTabsButton.addEventListener('click', handleButtonAction('Save Tabs to Procrastination List', distractingTabs));
      buttonsContainer.appendChild(saveTabsButton);

      const saveAndCloseTabsButton = document.createElement('button');
      saveAndCloseTabsButton.textContent = 'Save and Close Tabs';
      saveAndCloseTabsButton.classList.add('btn', 'btn-primary');
      saveAndCloseTabsButton.addEventListener('click', handleButtonAction('Save and Close Tabs', distractingTabs));
      buttonsContainer.appendChild(saveAndCloseTabsButton);

      const doNothingButton = document.createElement('button');
      doNothingButton.textContent = 'Do Nothing';
      doNothingButton.classList.add('btn', 'btn-primary');
      doNothingButton.addEventListener('click', handleButtonAction('Do Nothing', distractingTabs));
      buttonsContainer.appendChild(doNothingButton);

      actionsContainer.appendChild(buttonsContainer);
      chatContainer.appendChild(actionsContainer);
      browser.storage.local.remove('distractingTabs');
    }
    // Handle chatbot intervention if it exists. WIP
    if (chatbotInterventionTriggered) {
      const chatContainer = document.getElementById('chat-container');
      const actionsContainer = document.createElement('div');
      actionsContainer.classList.add('actions-container');
    
      const buttonsContainer = document.createElement('div');
      buttonsContainer.classList.add('button-container');
    
      const yesButton = document.createElement('button');
      yesButton.textContent = 'Yes';
      yesButton.classList.add('btn', 'btn-primary');
      yesButton.addEventListener('click', () => {
        browser.storage.local.remove('chatbotInterventionTriggered');
        storeMessageInConversation('User', "Yes").then(conversation => {
          sendConversationToBackgroundScript(conversation);
        });
      });
      buttonsContainer.appendChild(yesButton);
    
      const noButton = document.createElement('button');
      noButton.textContent = 'No';
      noButton.classList.add('btn', 'btn-primary');
      noButton.addEventListener('click', () => {
        browser.storage.local.remove(['chatbotInterventionTriggered']);
        storeMessageInConversation('User', "No", false).then(() => {
          browser.storage.local.get(["chatbotTrackingData", "conversation"]).then(result => {
            const conversationData = result.conversation || [];
            const chatbotTrackingData = result.chatbotTrackingData;
            
            chatbotTrackingData.nTotalMessages = conversationData.filter(msg => msg.message !== '...').length;
            chatbotTrackingData.nUserMessages = conversationData.filter(msg => msg.sender === "User").length;
            chatbotTrackingData.timeSpent = new Date().getTime() - chatbotTrackingData.startTime;
            
            console.log(chatbotTrackingData)
            browser.storage.local.set({ chatbotTrackingDataTemp: chatbotTrackingData});
            browser.storage.local.remove(["chatbotTrackingData", "chatbotInterventionTriggered"]);
            browser.runtime.sendMessage({ type: 'chatbotInterventionRejected' });
          }).then(() => {
            window.close();
          });
        });
      });
      buttonsContainer.appendChild(noButton);
    
      actionsContainer.appendChild(buttonsContainer);
      chatContainer.appendChild(actionsContainer);
    }
  });
});
}


// Render conversation in the chat container
function renderConversation(conversation) {
  const chatContainer = document.getElementById('chat-container');
  if (chatContainer) {
    chatContainer.innerHTML = '';

    const shouldScrollToBottom = chatContainer.scrollHeight - chatContainer.scrollTop === chatContainer.clientHeight;

    // Render each message in the conversation
    conversation.forEach(msg => {
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message', msg.sender);
      messageElement.innerHTML = msg.message;
      chatContainer.appendChild(messageElement);
    });

    if (shouldScrollToBottom) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
  else {
    console.log('chat-container not found');
  }
}


// Get conversation from storage
function getConversation() {
  return browser.storage.local.get('conversation').then(data => {
    if (data.conversation === undefined) {
      return [];
    } else {
      return data.conversation;
    }
  });
}

// Store conversation in storage
function storeConversation(conversation) {
  return browser.storage.local.set({ conversation });
}

// Send conversation to background script
function sendConversationToBackgroundScript(conversation) {
  const conversationWithoutPlaceholder = conversation.filter(msg => msg.sender !== 'Assistant' || msg.message !== '...');
  browser.runtime.sendMessage({ type: 'sendLLMMessage', conversation: conversationWithoutPlaceholder }).then(loadConversation);
}

// Disable send button
function disableSendButton() {
  document.getElementById('sendMessageBtn').disabled = true;
  document.getElementById('sendMessageBtn').style.opacity = '0.5'; 
  document.getElementById('interveneBasicPromptBtn').disabled = true;
  document.getElementById('interveneBasicPromptBtn').style.opacity = '0.5';
}

// Enable send button
function enableSendButton() {
  document.getElementById('sendMessageBtn').disabled = false;
  document.getElementById('sendMessageBtn').style.opacity = '1';
  document.getElementById('interveneBasicPromptBtn').disabled = false;
  document.getElementById('interveneBasicPromptBtn').style.opacity = '1';
}

function closeDistractingTabs(distractingTabs) {
  const distractingTabIds = distractingTabs.map(tab => tab.id);
  browser.tabs.remove(distractingTabIds);
}

async function saveDistractingTabs(distractingTabs) {
  // Get existing distracting entries from local storage
  const storedData = await browser.storage.local.get('distractingEntries');
  const existingDistractingEntries = storedData.distractingEntries || [];

  // Create new entries from distractingTabs
  const newEntries = distractingTabs.map(tab => ({
    title: tab.title,
    url: tab.url,
    timestamp: new Date().getTime()
  }));

  // Update existing entries and add new entries if they don't exist
  for (const newEntry of newEntries) {
    const existingEntryIndex = existingDistractingEntries.findIndex(entry => entry.url === newEntry.url);
    if (existingEntryIndex !== -1) {
      existingDistractingEntries[existingEntryIndex].timestamp = newEntry.timestamp;
    } else {
      existingDistractingEntries.push(newEntry);
    }
  }

  existingDistractingEntries.sort((a, b) => b.timestamp - a.timestamp);
  await browser.storage.local.set({ distractingEntries: existingDistractingEntries });
}

// Initialize the tracking data based on the intervention type
function initializeTrackingData() {
  return browser.storage.local.get(['listInterventionTriggered', 'chatbotInterventionTriggered', 'distractingTabs', 'distractingEntries']).then(data => {
    if (data.listInterventionTriggered !== undefined) {
      console.log("list opened");
      let nTabsOpenDistracting = 0;
      let nTabsInList = 0;
      if (data.distractingTabs !== undefined) {
        nTabsOpenDistracting = data.distractingTabs.length;
      }
      if (data.distractingEntries !== undefined) {
        nTabsInList = data.distractingEntries.length;
      }
      browser.tabs.query({}).then(tabs => {
        const listTrackingData = {
          isTriggered: data.listInterventionTriggered || false,
          startTime: new Date().toLocaleString(),
          nTabsOpenDistracting: nTabsOpenDistracting,
          nTabsInList: nTabsInList,
          nTabsOpenTotal: tabs.length,
          nTabsRetrieved: -1
        };
        browser.storage.local.set({ listTrackingData });
      });
    }
    
    else if (data.chatbotInterventionTriggered) {
      console.log("chat opened");
      const chatbotTrackingData = {
        isTriggered: data.chatbotInterventionTriggered || false,
        startTime: new Date().getTime()
      };
      browser.storage.local.set({ chatbotTrackingData });
    } 
  });
}

// Send tracking data when the chat window is closed
function sendTrackingData() {
  console.log("chat window closing")
  browser.storage.local.get(["chatbotTrackingData", "listTrackingData", "conversation"]).then(result => {
    if (result.listTrackingData) {
      console.log("list closed")
      const listTrackingData = result.listTrackingData;
      listTrackingData.nTabsClosed = listTrackingData.nTabsClosed || 0;
      listTrackingData.nTabsToList = listTrackingData.nTabsToList || 0;
      listTrackingData.optionChosen = listTrackingData.optionChosen || 'Window Closed';


      browser.storage.local.set({ listTrackingDataTemp: listTrackingData});
      browser.storage.local.remove(["listTrackingData", "listInterventionTriggered"]);
      browser.runtime.sendMessage({ type: 'openInterventionRatingPopup' });

    }
    else if (result.chatbotTrackingData) {
      console.log("chat closed")
      const conversationData = result.conversation || [];
      const chatbotTrackingData = result.chatbotTrackingData;
      
      chatbotTrackingData.nTotalMessages = conversationData.filter(msg => msg.message !== '...').length;
      chatbotTrackingData.nUserMessages = conversationData.filter(msg => msg.sender === "User").length;
      chatbotTrackingData.timeSpent = new Date().getTime() - chatbotTrackingData.startTime;
      
      console.log(chatbotTrackingData)
      browser.storage.local.set({ chatbotTrackingDataTemp: chatbotTrackingData});
      browser.storage.local.remove(["chatbotTrackingData", "chatbotInterventionTriggered"]);
      browser.runtime.sendMessage({ type: 'openInterventionRatingPopup' });
    }
  });
}

// Add event listener for window or tab close
window.addEventListener('blur', sendTrackingData);

window.onbeforeunload = function(e){
  window.blur();
}