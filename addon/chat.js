// chat.js - interaction with the interventions
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('chat-container') !== null) {
      loadConversation();
      setEventListeners();
  };
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
  storeMessageInConversation('User', message).then(messageHistory => {
    llmConversation(messageHistory);
  });
  inputField.value = '';
  loadConversation();
}

// Intervene with a basic prompt. Currently unused.
function interveneBasicPrompt() {
  // Fetch variables from storage
  browser.storage.local.get(['task', 'relatedContent']).then(({ task, relatedContent }) => {
    const message = `Hey, I'm currently procrastinating on the following task: ${task}. Here are some examples of what kinds of content might be relevant to my task: ${relatedContent}. Could you help me get back on track?`;

    storeMessageInConversation('User', message).then(messageHistory => {
      llmConversation(messageHistory);
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

    browser.storage.local.get(['distractingTabs', 'chatbotInterventionTriggered']).then(({ distractingTabs, chatbotInterventionTriggered }) => {
      // Handle distracting tabs if they exist and show interactive buttons
      if (distractingTabs) {
        const chatContainer = document.getElementById('chat-container');
        const lastMessage = chatContainer.lastElementChild;

        // Create checkboxes for each distracting tab
        const checkboxesHtml = distractingTabs.map((tab, index) => `
          <div>
            <input type="checkbox" id="tab-${index}" checked>
            <label for="tab-${index}">${tab.title} (${tab.url})</label>
          </div>
        `).join('');

        lastMessage.innerHTML = `It looks like you have some distracting tabs open:<br><br>${checkboxesHtml}<br><br>What would you like to do with them?`;

        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('actions-container');

        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('button-container');

        function handleButtonAction(action, distractingTabs) {
          return () => {
            const selectedTabs = distractingTabs.filter((tab, index) => 
              document.getElementById(`tab-${index}`).checked
            );
        
            storeMessageInConversation('User', action, false).then(() => {
              // Perform action based on the button clicked
              switch (action) {
                case 'Close Tabs':
                  closeDistractingTabs(selectedTabs);
                  break;
                case 'Save Tabs to Procrastination List':
                  saveDistractingTabs(selectedTabs);
                  break;
                case 'Save and Close Tabs':
                  saveDistractingTabs(selectedTabs);
                  closeDistractingTabs(selectedTabs);
                  break;
                case 'Do Nothing':
                  break;
                default:
                  break;
              }
              browser.storage.local.remove('distractingTabs').then(() => {
                enableSendButton();
                loadConversation();
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
    // Handle chatbot intervention if it exists.
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
        storeMessageInConversation('User', "Yes").then(messageHistory => {
          llmConversation(messageHistory);
        });
      });
      buttonsContainer.appendChild(yesButton);
    
      const noButton = document.createElement('button');
      noButton.textContent = 'No';
      noButton.classList.add('btn', 'btn-primary');
      noButton.addEventListener('click', () => {
        browser.storage.local.remove(['chatbotInterventionTriggered']);
        storeMessageInConversation('User', "No", false).then(() => {
          window.close();
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

function closeDistractingTabs(selectedTabs) {
  const selectedTabIds = selectedTabs.map(tab => tab.id);
  browser.tabs.remove(selectedTabIds);
}

async function saveDistractingTabs(selectedTabs) {
  // Get existing distracting entries from local storage
  const storedData = await browser.storage.local.get('distractingEntries');
  const existingDistractingEntries = storedData.distractingEntries || [];

  // Create new entries from selected tabs
  const newEntries = selectedTabs.map(tab => ({
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

// Basic interaction with the chatbot
async function llmConversation(messageHistory) {
  messageHistory = await messageHistory.filter(msg => msg.sender !== 'Assistant' || msg.message !== '...')
  console.log(messageHistory);
  loadConversation();

  let task, relatedContent, commonDistractions, llmPort;
  await browser.storage.local.get(['task', 'relatedContent', 'commonDistractions', 'settings']).then(result => {
    task = result.task;
    relatedContent = result.relatedContent;
    commonDistractions = result.commonDistractions;
    llmPort = result.settings.llmPort;
  });

  const systemPrompt = `
You are a compassionate and non-judgmental assistant who is helping a user overcome distractions and stay focused on their goals. You do NOT give unsolicited advice and focus on being supportive and understanding. You take care to not make the user feel ashamed or guilty about their distractions.
Here is some information about the user:
Current task: ${task}
Examples of useful content for the task: ${relatedContent}
Common distractions of the user: ${commonDistractions}
Ask the user how they feel right now. You do NOT confront the user with the assumption that they could be distracted. You do NOT refer to the user information unless asked to. Your answers have at most 20 words unless the user specifically asks for a longer answer. You talk in a casual, concise and to the point-style just like the user, using the tone of a friend.
`;

  messageHistory = [
    { role: "system", content: systemPrompt },
    ...messageHistory.map(item => ({
      role: item.sender.toLowerCase(),
      content: item.message
    }))
  ];
  
  const response = await fetch(`http://localhost:${llmPort}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: messageHistory,
      max_tokens: 100,
      temperature: 0,
      repetition_penalty: 1.15,
      stop: ["user", "assistant", "\n", "User", "Assistant"]
    })
  });

  const data = await response.json();
  console.log();
  let llmOutput = data.choices[0].message.content
  .replace(/\\n/g, "\n")
  .replace(/Assistant:/, "")
  .replace(/<assistant>/g, "");
  console.log(llmOutput);
  replacePlaceholder(llmOutput);
  enableSendButton();
};
