
# Table of Contents
* [About](#about)
* [Features](#features)
* [Installation](#installation)
* [Study Conditions](#study-conditions)
* [How it Works](#how-it-works)
* [Privacy](#privacy)
* [FAQ](#faq)

# About

ProcrastiScan helps you stay focused and productive by continually checking if the content you're viewing aligns with what you actually want to be doing. 

**Currently, the extension is in the stage of being a proof of concept study for a bachelor's thesis. For the duration of the study (approximately till the end of June), the extension will be in a limited state (see the "Study Conditions" section).**

## Features

- **Theme Nudging**: Your browser toolbar will be colored in a bright red tone if you get distracted to increase your mindfulness.

- **Identify Distracting Tabs**: Automatically identify tabs that are likely unrelated to your current task and decide whether to close them or save them for later.

- **LLM-assisted Conversation**: Engage in a focused conversation with an AI assistant to get back on track or reflect on why you got distracted.

- **Dashboard**: View your similarity score history and see when you were most focused or distracted. 
## Installation

### Step 1: Set up the extension server
#### Option 1, using Python:
1. Install Python if you don't have it already.
2. Clone or download this repository.
3. Right-click while holding the Shift key inside the installation folder and select "Open in Terminal".
4. Install the required Python dependencies by running `pip install -r requirements.txt`.
5. Launch the server script by executing `python server.py`. 

#### Option 2, without Python: 
1. Download the procrastiscan-server-v1.1.0.exe file [here](https://github.com/Marc-Pk/ProcrastiScan/releases/tag/release) and save it in a new folder.
2. Launch the server by double-clicking the .exe file.

**The ProcrastiScan server must be running at all times for the extension to work.**

### Step 2: Set up the LLM server
Install a LLM-server if you don't have one already or prefer an external API service. You can use any OpenAI-like API provider you prefer to connect to a language model. For example, here are the steps for LMStudio:

1. Download [LMStudio](https://lmstudio.ai/)
2. Launch the program and download a LLM. Llama 3 - 8B Instruct is recommended, but if you have a weak computer you can use a smaller model such as Gemma 2B Instruct.
3. Go to the "Local Server" tab and load the model you downloaded.
4. Under "Configuration", set the server port to 5000 and make sure that "Apply Prompt Formatting" is switched on.
5. Click "Start Server" and press the below button.

### Step 3: Download the browser extension
You can get it [here](https://addons.mozilla.org/en-US/firefox/addon/procrastiscan/) for Firefox or [here](https://chromewebstore.google.com/detail/procrastiscan/pjieainhjbcopkledhjjlnajfelblpnp) for Chrome and other browsers. After installation, you will be guided through the setup process.

**If you restart your computer at any point instead of waking it up from sleep, you will need to restart both servers.**

## Study Conditions

For the duration of the study, this addon has several limitations:

- every 3 days, the "triggerable" feature will change. This means the default intervention (distraction list, chatbot, and nudging if you use Firefox) that will be enacted when the addon considers you to get distracted. **In the end, there will be a 3 day baseline period where no interventions will be triggered automatically**

- you can participate in a raffle if you complete the full study (12 days for Firefox / 9 days for other browsers), two winners will receive 20€ each

- you will be prompted to enter how stressed and distracted you feel once per hour

- the extension will collect limited data exclusively for the purpose of this study. See the [Privacy section](#privacy) for more information.

## How it Works

1. After installing the extension, you'll be guided through a setup process. Here, you'll provide details about your current task, related content, and common distractions.

2. The extension will continuously monitor your browsing activity and provide a similarity rating based on the content you're viewing and your specified task.

3. If you encounter distracting tabs or websites, the extension will prompt you with options to close, save, or manage those distractions.

4. You can access the extension's user interface by clicking the icon in your browser's toolbar. From there, you can update your task and content information, view the procrastination list, or engage in a focused conversation with the AI assistant.

## Privacy

### Processing

ProcrastiScan works completely offline and does not send any data to external servers, except for the duration of the study as described below. 

### For the duration of the study

Some data will be sent to a European Google Firebase server every 3 days:

- the extension will prompt you to provide information about your gender, age, whether you are diagnosed with autism/ADHD and optionally your email address if you want to participate in the raffle. Additionally your user agent header and language will be logged. This data is used for analysis and interpretation of the study results. 

- metadata on how you interact with the intervention features. For example, timestamps of when they are triggered, how many tabs are open/closed/saved, whether you click away a popup or interact with it. The extension does **not** send any contextual or personal information such as tab contents, urls, titles, your browsing history or what you talk about with the AI assistant.

- data you provide in self-report popups and the calculated similarity scores

To exercise your GDPR-related rights or in case of any questions, contact me at procrastiscan@gmail.com

### After the study

Everything is stored and processed on your device only unless you manually choose to use an external LLM API service. There will be no data collection after the study is over. 


## FAQ

### Which browsers and operating systems are supported?
ProcrastiScan only works with Windows currently. Firefox is the only browser to include the nudging intervention. Chrome is supported and the respective extension should also be compatible with Opera and MS Edge.

### What are limitations I should be aware of?
Technical: 
- You will run into trouble if you use different browsers at the same time. Do not install the extension on multiple browsers.

Functional:
- ProcrastiScan currently can't help you in regards to endless scrolling on the same page or falling into rabbit holes about random topics you didn't include in the distracting topics list.
- the chatbot experience is limited by the quality of the language model you use and is unlikely to fully grasp the context of your situation.

### How does the similarity scoring work?
The scores are calculated by how semantically similar the tab title + domain is to the information you provided about your task and related/distracting content. The score ranges roughly from 0-1, with values below 0.5 being interpreted as distracting content. 

### How how can I make the scores closer to what I expect?
Your information must be semantically related to the content. For example, if you enter "browsing mindlessly" as a distraction, that is not semantically similar to a tab called "Cat Videos - YouTube". If you were to enter "pets" instead, the similarity to the tab title would be a lot higher. However, proper nouns such as specific websites or creator names should be entered as they are.
