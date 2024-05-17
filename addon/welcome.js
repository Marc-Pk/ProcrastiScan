// welcome.js - onboarding process

let userInfoFilled = false;
let llmConnected = browser.storage.local.get('llmConnected') || "waiting"; 
let currentStep = 0;

document.addEventListener('DOMContentLoaded', e => {
  e.preventDefault();
  const userInfoSection = document.getElementById('userInfoSection');
  const serverSetupDiv = document.getElementById('serverSetup');
  const llmCheckSection = document.getElementById('llmCheckSection');
  const llmCheckSectionError = document.getElementById('llmCheckSectionError');
  const demonstratePopupDiv = document.getElementById('demonstratePopupSection');
  const proceedToStudyInfoBtn = document.getElementById('proceedToStudyInfoBtn');
  const studyInfoSection = document.getElementById('studyInfoSection');
  const SetupCompleteDiv = document.getElementById('setupCompleteSection');
  
  
  // Test server status
  console.log('Checking server status...');
  if (currentStep === 0) {
  browser.storage.local.get('websocketConnected').then(result => {
    updateServerStatus(result.websocketConnected);
  });
  }

  // Test LLM connection
  document.getElementById('testLlmBtn').addEventListener('click', e => {
    e.preventDefault();
    browser.runtime.sendMessage({ type: 'testLlm' });
  });

  // Open toolbar icon button event listener
  document.getElementById('openToolbarBtn').addEventListener('click', e => {
    e.preventDefault();
    browser.browserAction.openPopup();
  });

  // Show proceed button to study info after toolbar has been opened
  document.getElementById('proceedToStudyInfoBtn').addEventListener('click', e => {
    e.preventDefault();
    currentStep = 3;
    userInfoSection.style.display = 'none';
    demonstratePopupDiv.style.display = 'none'; 
    studyInfoSection.style.display = 'block';
  });


  // Save study info data
  document.getElementById('saveStudyInfoBtn').addEventListener('click', e => {
    e.preventDefault();
    const genderSelect = document.getElementById('gender');
    const ageInput = document.getElementById('age');
    const autismCheckbox = document.getElementById('autism');
    const adhdCheckbox = document.getElementById('adhd');
    const pdaCheckbox = document.getElementById('pda');
    const emailInput = document.getElementById('email');
    const recruitmentSourceInput = document.getElementById('recruitmentSource');
    const privacyInfoCheckbox = document.getElementById('privacyInfoConfirmed');
  
    // Get values from the form elements
    const gender = genderSelect.value;
    const age = ageInput.value;
    const diagnoses = [];
    const email = emailInput.value;
    const recruitmentSource = recruitmentSourceInput.value;
  
    // Check if age is numeric only
    const isNumericAge = /^\d+$/.test(age);
  
    // Check if email is valid
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
    // Check if any field is empty except for optional fields
    let isValid = true;
  
    if (!isNumericAge || age === '') {
      isValid = false;
      ageInput.style.border = '3px solid red';
    } else {
      ageInput.style.border = '';
    }
  
    if (gender === '') {
      isValid = false;
      genderSelect.style.border = '3px solid red';
    } else {
      genderSelect.style.border = '';
    }

    if (!isEmailValid && email !== '') {
      isValid = false;
      emailInput.style.border = '3px solid red';
    } else {
      emailInput.style.border = '';
    }
  
    // Construct the array of diagnoses
    if (autismCheckbox.checked) {
      diagnoses.push('autism');
    }
    if (adhdCheckbox.checked) {
      diagnoses.push('adhd');
    }
    if (pdaCheckbox.checked) {
      diagnoses.push('pda');
    }
    if (!privacyInfoCheckbox.checked) {
      isValid = false;
      privacyInfoCheckbox.style.outline = '3px solid red';
    }
  
    // Construct the study_info object
    const study_info = {
      gender: gender,
      age: age,
      diagnoses: diagnoses,
      email: email,
      browser_info: navigator.userAgent,
      language: navigator.language,
      recruitment_source: recruitmentSource
    };
  
    // Send the message to background script if all required fields are filled and valid
    if (isValid) {
      browser.runtime.sendMessage({ type: 'updateStudyInfo', study_info });
      console.log('Study info saved!');
      studyInfoSection.style.display = 'none';
      SetupCompleteDiv.style.display = 'block';
    }
  });
  

  // Check server status button event listener
  document.getElementById('checkServerBtn').addEventListener('click', e => {
    e.preventDefault();
    console.log('Checking server status...');
    browser.runtime.sendMessage({ type: 'checkServerStatus' });
    browser.storage.local.get('websocketConnected').then(result => {
      updateServerStatus(result.websocketConnected);
    });
  });

  // Check server connection and display the appropriate sections
  function updateServerStatus(websocketConnected) {
    console.log('Server status:', websocketConnected);
    if (websocketConnected === true) {
      console.log('Server is connected!');
      updateLmStatus();

      if (llmConnected === "connected") {
          userInfoSection.style.display = 'block';
          serverSetupDiv.style.display = 'none';
          llmCheckSection.style.display = 'none';
          currentStep = 1;
        }
       else {
          userInfoSection.style.display = 'none';
          serverSetupDiv.style.display = 'none';
          llmCheckSection.style.display = 'block';
        }
      
    } else {
      userInfoSection.style.display = 'none';
      serverSetupDiv.style.display = 'block';
      llmCheckSection.style.display = 'none';
      userInfoFilled = false;
      currentStep = 0;
    }
  }

  function updateLmStatus() {
    if (llmConnected === "connected") {
      llmCheckSection.style.display = 'none';
      llmCheckSectionError.style.display = 'none';
      if (currentStep === 0) {
        serverSetupDiv.style.display = 'none';
        userInfoSection.style.display = 'block';
      } if (currentStep === 1) {
        userInfoSection.style.display = 'none';
        demonstratePopupDiv.style.display = 'block';
      }

      // Retrieve and set the stored values when the server is connected, but only if userInfoFilled is false
      if (userInfoFilled === false) {
        browser.storage.local.get(['task', 'relatedContent', 'commonDistractions']).then(result => {
          const task = result.task || '';
          const relatedContent = result.relatedContent || '';
          const commonDistractions = result.commonDistractions || '';
          const taskElement = document.getElementById('task');
          const relatedContentElement = document.getElementById('relatedContent');
          const commonDistractionsElement = document.getElementById('commonDistractions');
          taskElement.value = task;
          relatedContentElement.value = relatedContent;
          commonDistractionsElement.value = commonDistractions;
        });
      }
    } 
    if (llmConnected === "error") {
      llmCheckSectionError.style.display = 'block';
    }
    if (llmConnected === "waiting"){
      console.log('LLM not connected'); 
      userInfoSection.style.display = 'none';
      demonstratePopupDiv.style.display = 'none';
      llmCheckSection.style.display = 'block';
    }
  }

  // Listen for changes in server status
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && 'websocketConnected' in changes) {
      updateServerStatus(changes.websocketConnected.newValue);
    }

    if (areaName === 'local' && 'llmConnected' in changes) {
      llmConnected = changes.llmConnected.newValue;
      console.log('LLM connection status:', llmConnected);
      updateLmStatus();
    }
  });

  // Save user info and check if all fields are filled
  document.getElementById('saveUserInfoBtn').addEventListener('click', e => {
    e.preventDefault();
    userInfoFilled = true; // Set userInfoFilled to true when user clicks the save button
    const taskInput = document.getElementById('task');
    const relatedContentInput = document.getElementById('relatedContent');
    const commonDistractionsInput = document.getElementById('commonDistractions');

    // Trim trailing non-alphanumeric characters
    const taskValue = taskInput.value.trim().replace(/[^\w\s]+$/, '') || null;
    const relatedContentValue = relatedContentInput.value.trim().replace(/[^\w\s]+$/, '') || null;
    const commonDistractionsValue = commonDistractionsInput.value.trim().replace(/[^\w\s]+$/, '') || null;
    


    // Check if any field is empty after trimming
    if (!taskValue) {
      taskInput.style.border = "3px solid red";
    } else {
      taskInput.style.border = "";
      browser.storage.local.set({ task: taskValue });
    }

    if (!relatedContentValue) {
      relatedContentInput.style.border = "3px solid red";
    } else {
      relatedContentInput.style.border = ""; 
      browser.storage.local.set({ relatedContent: relatedContentValue });
    }

    if (!commonDistractionsValue) {
      commonDistractionsInput.style.border = "3px solid red";
    } else {
      commonDistractionsInput.style.border = "";
      browser.storage.local.set({ commonDistractions: commonDistractionsValue });
    }

    if (taskValue && relatedContentValue && commonDistractionsValue) {
      const user_info = {
        task: taskValue,
        relatedContent: relatedContentValue,
        commonDistractions: commonDistractionsValue
      };

      browser.runtime.sendMessage({ type: 'updateUserInfo', user_info });
      
      browser.storage.local.set({ addonInitialized: true });
      currentStep = 2; 
      demonstratePopupDiv.style.display = 'block'; 
    }
  });
});
