# ProcrastiScan
Downloads:

[Firefox](https://addons.mozilla.org/en-US/firefox/addon/procrastiscan/) | [Chrome, MS Edge, Opera](https://chromewebstore.google.com/detail/procrastiscan/pjieainhjbcopkledhjjlnajfelblpnp)

[Extension Server](https://github.com/Marc-Pk/ProcrastiScan/releases)

ProcrastiScan helps you stay focused and productive by continually checking if the content you're viewing aligns with what you actually want to be doing.

As you browse, a **Relevance Score** is calculated for every tab, based on how similar it is to your task and your descriptions of relevant/distracting content. If the score is higher than 0.5, content is considered relevant, lower scores are considered distracting. An averaged **Focus Score** is calculated to reflect your current level of focus. If it falls below 0.5, ProcrastiScan assumes you're distracted and one of various interventions to choose from will be activated.


# Table of Contents
* [Features](#features)
* [Quick Setup](#quick-setup)
* [Usage Guide](#usage-guide)
* [Server Setup](#server-setup)
  * [Extension Server](#how-to-set-up-the-extension-server)
  * [LLM Server](#how-to-set-up-the-llm-server)
* [Privacy](#privacy)
* [FAQ](#faq)


# Features
- **Smart Distraction Recognition**: All your browsing activity is scored in real-time for how distracting it is, based on meaning rather than just keyword matching

- **Multiple intervention modes** for when you become distracted:
  - **Tab Blocking**: Automatically detect distracting tabs and block them 

  - **Chatbot**: Engage in a focused conversation with an AI assistant to get back on track or reflect on why you got distracted. Requires a local LLM connection, highly experimental

  - **Procrastination List**: Recognize and save distracting tabs for later 

  - **Theme Nudging (Firefox only)**: Your browser toolbar will be colored in a bright red tone if you get distracted to increase your mindfulness

- **Dashboard**: See at which times you were focused or distracted

# Quick Setup

After installing the extension, the **Settings** page should open. Select the intervention type and times you want, hover over each option for details. 

Open the **Overview** tab to provide details about your current task and what contents are typically relevant/distracting for you. Think of the keywords as topics (check out the [Usage Guide](#usage-guide) and the [FAQ](#faq)) and try to come up with at least 5 for each category. When you're done, click "Save Settings".

For quick access, pin the ProcrastiScan icon to your browser's toolbar. The browser extension can only see what happens in your browser. It is highly recommended to set up the [extension server](#how-to-set-up-the-extension-server) to score all programs instead of just browser tabs. 

# Usage Guide
**Choose good keywords**: While your task may change often, the keywords for related/distracting content are typically more stable. If the scores you see are not what you expect, try to focus on adjusting the keywords instead of the task. Make sure that they are related in meaning to the content you want to avoid/focus on.

**Example**: You want to write an essay about anthropology in Word. You need Wikipedia and sometimes YouTube for your research, but also get distracted by reading about politics and news or watching sports videos.

- **Task**:
  
  ❌<span style="color:red">I want to work on my paper</span> -> too vague

  ✅<span style="color:green">research and write anthropology paper</span> -> specifies research and the topic
- **Related Content**: 

  ❌<span style="color:red">work, wikipedia articles</span> -> too few keywords, no mention of topics, "work" doesn't indicate what is relevant or not

  ✅<span style="color:green">anthropology, essay.docx, academic articles, wikipedia, Word</span> -> relevant topics, makes the file you spend a lot of time on easy to recognize by matching the file and program names
- **Distracting Content**: 

  ❌<span style="color:red">not writing or researching, random stuff, videos</span> -> not doing something is semantically related to its opposite, so it will be ineffective. "random stuff" can't be matched to anything specific. "videos" could match even relevant content.

  ✅<span style="color:green">youtube, sports, politics, news, election, trending</span> -> relevant topics, makes it easy to recognize the content you want to avoid. "youtube" can be useful to mention even if you need it for research, if most of your distractions happen there and you specify the relevant topics properly. If there was an election recently and your news feed is full of articles about it, mentioning "election" can help to match doomscrolling indirectly. Likewise, if your procrastination tends to start on the YouTube "trending" page, it can be easily recognized this way.


# Server Setup

You can extend ProcrastiScan in two optional ways:

- score all programs instead of just browser tabs -> set up the **extension server**
- chatbot intervention -> set up a **LLM server**

**If you restart your computer at any point instead of waking it up from sleep, you will need to restart both servers.**

### How to set up the extension server:
#### Option 1, no Python required: 
1. Download the most recent procrastiscan-server.exe file [here](https://github.com/Marc-Pk/ProcrastiScan/releases).
2. Launch the server by double-clicking the .exe file. Your anti-virus software might flag the file - if you're concerned about security, you can use the Python method described below instead and check the source code of the `procrastiscan-server.py` file.

#### Option 2, using Python:
1. Install Python if you don't have it already.
2. Clone this repository or download the `procrastiscan-server.py` and `requirements.txt` files.
3. Right-click while holding the Shift key inside the installation folder and select "Open in Terminal".
4. Install the required Python dependencies by running `pip install -r requirements.txt`.
5. Launch the server script by executing `python procrastiscan-server.py`. 


### How to set up the LLM server
This is only relevant if you want to use the chatbot intervention, which is highly experimental and not currently recommended. Install a LLM-server if you don't have one already. Your computer will need to have at least 8GB of RAM available. You can use any OpenAI-like API provider you like to connect to a language model. For example, here are the steps for LMStudio:

1. Download [LMStudio](https://lmstudio.ai/)
2. Launch the program and download a LLM that fits using the "Discover" Tab. The mode in the lower left should be "Developer" or "Power User".
3. Load the model, go to the "Developer" tab and start the server.
4. Under "Settings", set the server port to 5000. If you want to use a different port, open the ProcrastiScan settings tab and change the "LLM Port" value.
5. You can verify that the server is connected by checking the "LLM Connection Status" indicator in the ProcrastiScan settings tab. 

# Privacy
ProcrastiScan works completely offline and does not collect any data.

# FAQ

### Why are the scores different than I expected?
ProcrastiScan utilizes the concept of **semantic similarity** ("how much does A have to do with B?"). For example, if you enter "browsing mindlessly" as a distraction, that is not semantically similar to a tab called "Cat Videos - YouTube". If you were to enter "pets" instead, the similarity to the tab title would be a lot higher. However, proper nouns such as names of websites, tools or creators should be entered literally as the model might not know about them.

The accuracy of the scoring will also likely improve over time if you keep adding new keywords. If you use the Tab Blocking intervention, giving feedback on the blocked tabs will help the system learn which content is relevant to you.

Also keep in mind that the [extension server](#how-to-set-up-the-extension-server) is required to score all programs instead of just browser tabs. If you don't have it running, the extension will only be able to score the currently active tab in your browser.

### Which browsers and operating systems are supported?
ProcrastiScan has only been tested under Windows. **Firefox** is the only browser to include the nudging intervention. **Chrome** is supported, and the extension should also be compatible with **Opera** and **MS Edge**.

### What are limitations I should be aware of?
- important tabs like booking processes, chats, or LLM providers might be accidentally blocked when using the Tab Blocking intervention, leading to data loss. It can also happen that such pages can be accessed at first but are blocked after switching to the tab later, in case your Focus Score drops below 0.5 meanwhile. Add frequently used important domains to the allow list either on the blocking page or the Filters tab

- the scoring is mostly a proof of concept at the moment and may not always be accurate. The system might not work well if the information that you provide about your task, related content and common distractions is too vague

- interventions can only act on distractions inside your browser

- ProcrastiScan currently can't help you in regards to endless scrolling on the same page, or falling into rabbit holes about random topics that you didn't include in the distracting topics list

- the chatbot experience is limited by the quality of the language model you use. It is unlikely to fully grasp the context of your situation or provide you with useful advice

- if you use multiple different browsers at the same time, only activity in the browser where you installed ProcrastiScan will be scored, even if you use the extension server

### How do I interpret the score values?
The **Relevance Score** quantifies the semantic similarity of the tab title + domain (or program name + title) to the information that you provided about your task and related/distracting content. The score ranges roughly from 0-1, with 0.5 being a neutral point. Higher values indicate relevance, while lower values indicate distraction.

The **Focus Score** averages the values of the last 10 minutes and weighs them by the time spent on each tab. If this score falls below 0.5, you are considered to be distracted and an intervention is triggered.

It is much more important whether either score is above or below 0.5 than the actual value. 0.6 can mean a fine level of focus just like 0.9, as the values depend heavily on your particular set of keywords. 
