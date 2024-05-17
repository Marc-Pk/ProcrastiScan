import sqlite3
import pandas as pd
from urllib.parse import urlparse
from sentence_transformers import SentenceTransformer, util
import numpy as np
import openai
import asyncio
import websockets
import json
import random
import win32gui
import win32process
import psutil
import pyautogui
import pyrebase
import hashlib
pd.options.mode.chained_assignment = None

# Change this to the port of your own LLM server if desired
LLM_PORT = 5000

# Initialize the Firebase app
config = {
    "apiKey": "AIzaSyDXCEihzLq-MuriPIKEtId3MgWDpuHbiT4",
    "authDomain": "mindful-addon.firebaseapp.com",
    "databaseURL": "https://mindful-addon-default-rtdb.europe-west1.firebasedatabase.app",    
    "storageBucket": "mindful-addon.appspot.com",
}

firebase = pyrebase.initialize_app(config)
storage = firebase.database()


class EmbeddingModel():
    def __init__(self, device="cpu"):
        self.device = device
        self.model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2', device=device)
    
    def embed(self, text):
        return self.model.encode(text)
        
    
class MindfulDB:
    def __init__(self, db_path):
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()

    def create_db(self):
        # Creates the database and tables if they do not exist.
        query_history = """CREATE TABLE IF NOT EXISTS history (
            time DATETIME,
            similarity_website_task DECIMAL(10,3),
            similarity_website_distractions DECIMAL(10,3),
            similarity_website_related_content DECIMAL(10,3),
            similarity_rating DECIMAL(10,3),
            similarity_rating_avg DECIMAL(10,3),
            title TEXT,
            url TEXT,
            domain TEXT,
            is_distracted INTEGER,
            PRIMARY KEY (time, url)
        );"""

        query_user_info = """CREATE TABLE IF NOT EXISTS user_info (
            time DATETIME,
            task TEXT,
            relatedContent TEXT,
            commonDistractions TEXT,
            PRIMARY KEY (time)
        );"""

        query_intervention_distractions_list = """CREATE TABLE IF NOT EXISTS intervention_distractions_list (
            time DATETIME,
            isTriggered BOOLEAN,
            optionChosen TEXT,
            nTabsOpenTotal INTEGER,
            nTabsOpenDistracting INTEGER,
            nTabsClosed INTEGER,
            nTabsToList INTEGER,
            nTabsInList INTEGER,
            interventionRating INTEGER,
            isProductiveTime INTEGER,
            PRIMARY KEY (time)
        );"""

        query_intervention_chatbot = """CREATE TABLE IF NOT EXISTS intervention_chatbot (
            time DATETIME,
            isTriggered BOOLEAN,
            nUserMessages INTEGER,
            nTotalMessages INTEGER,
            interventionRating INTEGER,
            isProductiveTime INTEGER,
            timeSpent INTEGER,
            PRIMARY KEY (time)
        );"""

        query_study_info = """CREATE TABLE IF NOT EXISTS study_info (
            time DATETIME,
            type TEXT,
            context TEXT,
            userStressLevel INTEGER,
            userDistractionLevel INTEGER,
            isProductiveTime INTEGER,
            PRIMARY KEY (time)
        );"""

        # Execute queries
        self.cursor.execute(query_history)
        self.cursor.execute(query_user_info)
        self.cursor.execute(query_intervention_distractions_list)
        self.cursor.execute(query_intervention_chatbot)
        self.cursor.execute(query_study_info)

        # Insert default user_info if there is none
        if self.get_user_info() is None:
            user_info = {"time": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
                         "task": "",
                         "relatedContent": "",
                         "commonDistractions": ""}
            self.write_back_user_info(user_info)

        self.conn.commit()

    def write_back_scores(self, df):
        # Write scores to history table
        df.to_sql("history", self.conn, if_exists="append", index=False, dtype={"time": "DATETIME"})
        self.conn.commit()

    def write_back_user_info(self, user_info):
        # Write user_info to user_info table
        user_info = pd.DataFrame([user_info])
        user_info["time"] = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
        user_info.to_sql("user_info", self.conn, if_exists="append", index=False, dtype={"time": "DATETIME"})
        self.conn.commit()

    def write_back_study_info(self, study_info, theme_intervention):
        # Save study_info during the onboarding process
        study_start_timestamp = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
        study_info["id"] = hashlib.md5(f"{study_start_timestamp}{study_info}".encode()).hexdigest()
        study_info_df = pd.DataFrame([{"time": study_start_timestamp, "type": "participantInfo"}]) 
        study_info_df["context"] = str(study_info)
        study_info_df.to_sql("study_info", self.conn, if_exists="append", index=False, dtype={"time": "DATETIME"})
        self.conn.commit()

        # Only include the nudging intervention if it's available
        if theme_intervention:
            available_intervention_types = ["procrastinationList", "chatbot", "nudging"]
        else:
            available_intervention_types = ["procrastinationList", "chatbot"]
            
        # Randomly pick the order of interventions available at a time
        random.shuffle(available_intervention_types)
        available_intervention_types.append("baseline")
        available_intervention_types.append("studyFinished")

        # Save intervention order with timestamps delayed by 3 days for each participant
        start_time = pd.Timestamp.now() + pd.Timedelta(seconds=1)
        intervention_schedule = []
        for intervention_type in available_intervention_types:
            query = "INSERT INTO study_info (time, type, context) VALUES (?, ?, ?)"
            self.cursor.execute(query, (start_time.strftime("%Y-%m-%d %H:%M:%S"), "availableInterventionType", intervention_type))
            intervention_schedule.append({"startTime": start_time.strftime("%Y-%m-%d %H:%M:%S"), "interventionType": intervention_type})
            start_time += pd.Timedelta(days=3)

        self.conn.commit()
        return intervention_schedule


    def write_back_tracking_data(self, tracking_type, tracking_data):
        # Write back intervention tracking data to the corresponding table
        if tracking_type == "chatbot":
            query = "INSERT INTO intervention_chatbot (time, isTriggered, nUserMessages, nTotalMessages, interventionRating, isProductiveTime, timeSpent) VALUES (?, ?, ?, ?, ?, ?, ?)"
            start_time = pd.Timestamp.now() - pd.Timedelta(milliseconds=tracking_data["timeSpent"])

            self.cursor.execute(query, (start_time.strftime("%Y-%m-%d %H:%M:%S"), tracking_data["isTriggered"], tracking_data["nUserMessages"], tracking_data["nTotalMessages"], tracking_data["interventionRating"], tracking_data["isProductiveTime"], tracking_data["timeSpent"]))
            self.conn.commit()

        elif tracking_type == "list":
            query = "INSERT INTO intervention_distractions_list (time, isTriggered, optionChosen, nTabsOpenTotal, nTabsOpenDistracting, nTabsClosed, nTabsToList, nTabsInList, interventionRating, isProductiveTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"

            self.cursor.execute(query, (pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"), tracking_data["isTriggered"], tracking_data["optionChosen"], tracking_data["nTabsOpenTotal"], tracking_data["nTabsOpenDistracting"], tracking_data["nTabsClosed"], tracking_data["nTabsToList"], tracking_data["nTabsInList"], tracking_data["interventionRating"], tracking_data["isProductiveTime"]))
            self.conn.commit()


    def write_back_self_report(self, self_report):
        # Write back self-report data to the study_info table
        query = "INSERT INTO study_info (time, type, context, userStressLevel, userDistractionLevel, isProductiveTime) VALUES (?, ?, ?, ?, ?, ?)"
        self.cursor.execute(query, (pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"), "selfReport", self_report["context"],
                                    self_report["stressLevel"], self_report["distractionLevel"], self_report["isProductiveTime"]))


    def get_user_info(self):
        # Get latest user_info
        query = "SELECT task, relatedContent, commonDistractions FROM user_info ORDER BY time DESC LIMIT 1"
        self.cursor.execute(query)
        try:
            user_info = dict(zip(["task", "relatedContent", "commonDistractions"], self.cursor.fetchone()))
            return user_info
        except TypeError:
            return None

    def get_latest_rating(self):
        # Get latest similarity_rating
        query = "SELECT similarity_rating FROM history ORDER BY time DESC LIMIT 1"
        self.cursor.execute(query)
        latest_rating = self.cursor.fetchone()
        return latest_rating[0]
    
    def get_current_content(self, column):
        # Get a specific value from the latest history entry
        query = "SELECT {} FROM history ORDER BY time DESC LIMIT 1".format(column)
        self.cursor.execute(query)
        return self.cursor.fetchone()[0]
    
    def check_self_report_timing(self):
        # Check if the self-report is due
        query = "SELECT time FROM study_info WHERE type = 'selfReport' AND context = 'selfReport' ORDER BY time DESC LIMIT 1"
        try:
            last_self_report_time = self.cursor.execute(query).fetchone()[0]
            if pd.Timestamp.now() - pd.Timestamp(last_self_report_time) > pd.Timedelta(minutes=60):
                return True
            else:
                return False
        # If there is no self-report in the database yet, return True
        except:
            return True

    def telemetry_export(self, currentIntervention, nextIntervention):
        # Export telemetry data to Firebase
        if currentIntervention != "studyFinished":
            query_participant_info = "SELECT context FROM study_info WHERE type = 'participantInfo'"
            query_intervention_timing = "SELECT time FROM study_info WHERE type = 'availableInterventionType' AND context = ?"

            time_min = self.cursor.execute(query_intervention_timing, (currentIntervention,)).fetchone()[0]
            time_max = self.cursor.execute(query_intervention_timing, (nextIntervention,)).fetchone()[0]

            query_intervention_distraction_data = "SELECT * FROM intervention_distractions_list WHERE time > ? AND time <= ?"
            query_intervention_chatbot_data = "SELECT * FROM intervention_chatbot WHERE time > ? AND time <= ?"
            query_self_report_data = "SELECT time, userStressLevel, userDistractionLevel, isProductiveTime FROM study_info WHERE type = 'selfReport' AND time > ? AND time <= ?"
            query_history_data = "SELECT time, similarity_rating, similarity_rating_avg FROM history WHERE time > ? AND time <= ?"

            participant_info = json.loads(self.cursor.execute(query_participant_info).fetchone()[0].replace("'", '"'))
            user_id = participant_info["id"]
            participant_info.pop("id")
            participant_info["currentIntervention"] = currentIntervention

            intervention_distraction_data = pd.read_sql(query_intervention_distraction_data, self.conn, params=(time_min, time_max)).fillna(-1).to_dict()
            intervention_chatbot_data = pd.read_sql(query_intervention_chatbot_data, self.conn, params=(time_min, time_max)).fillna(-1).to_dict()
            score_data = pd.read_sql(query_history_data, self.conn, params=(time_min, time_max)).fillna(-1).to_dict()
            self_report_data = pd.read_sql(query_self_report_data, self.conn, params=(time_min, time_max)).fillna(-1).to_dict()


            data = {"score_data": score_data, 
                    "intervention_distraction_data": intervention_distraction_data, 
                    "intervention_chatbot_data": intervention_chatbot_data, 
                    "self_report_data": self_report_data,
                    "participant_info": participant_info,
                    "user_id": user_id,
                    "timestamp_report": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "time_min": time_min,
                    "time_max": time_max
                    }
            #print(str(data))
            storage.push(data)
    
    def close(self):
        self.conn.close()


class LLM():
    def __init__(self):
        self.llm = openai.OpenAI(
            api_key="sk-111111111111111111111111111111111111111111111111",
            base_url=f"http://localhost:{LLM_PORT}/v1/"
        )

    def test_connection(self):
        # Test the connection to the LLM
        try:
            system_prompt = """
    You simply reply with "Test succeeded!".
    """
            message_history = [{"role": "system", "content": system_prompt}]

            llm_output = self.llm.chat.completions.create(
                messages=message_history,
                max_tokens=5,
                temperature=0,
                model="gpt-3.5-turbo",
                extra_body={
                "repetition_penalty": 1.15,
                "stopping_strings": ["user", "assistant", "\n", "User", "Assistant"]
                }
            ).choices[0].message.content
            return "connected"
        except:
            return "error"
    
    def predict_keywords(self, task: str):
        # Predict keywords using LLM. Currently disabled.
        prompt = f"Generate 10 search keywords for content and websites relevant to the following task, provide only keywords separated by commas and do not add any additional information. Each keyword should be independent of the others and refer to unique topics. Task: {task}"
        llm_output_raw = self.llm.chat.completions.create(
                            messages=[{"role": "user", "content": prompt}], 
                            max_tokens=300,
                            temperature=0.7,
                            model="gpt-3.5-turbo",
                            extra_body={
                                "repetition_penalty": 1.15,
                                "stopping_strings": ["", "}"]
                            }
                          ).choices[0].message.content.lower()
        
        return llm_output_raw
    
    def suggest_relevant_content(self, task: str, related_content: str, current_website: str):
        # Suggest relevant content using LLM. Currently disabled.
        prompt = f"""Hey, I'm currently procrastinating on the following task: {task}. Unfortunately I got distracted on this website: {current_website}. I think some more relevant topics might be something like these: {related_content}. Can you gently ask me to ask myself why I am on this website and if it is relevant to my task? And suggest me how to get back on track? Talk to me like a friend about this, I need some help."""

        llm_output_raw = self.llm.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.7,
            model="gpt-3.5-turbo",
            extra_body={
                "repetition_penalty": 1.15,
                "stopping_strings": ["", "}"]
            }
        ).choices[0].message.content

        # Clean up the output
        llm_output = llm_output_raw.strip().replace("\\n", "\n")

        return llm_output

    
    def conversation(self, conversation, task, related_content, common_distractions):
        system_prompt = f"""
You are a compassionate and non-judgmental assistant who is helping an user overcome distractions and stay focused on their goals. You do NOT give unsolicited advice and focus on being supportive and understanding. You take care to not make the user feel ashamed or guilty about their distractions.

Here is some information about the user:
Current task: {task}
Examples of useful content for the task: {related_content}
Common distractions of the user: {common_distractions}

Ask the user how they feel right now. You do NOT confront the user with the assumption that they could be distracted. You do NOT refer to the user information unless asked to. Your answers have at most 20 words unless the user specifically asks for a longer answer. You talk in a casual, concise and to the point-style just like the user, using the tone of a friend.
"""
        message_history = [{"role": "system", "content": system_prompt}]
        for item in conversation:
            sender = item['sender'].lower()
            message = item['message']
            message_history.append({"role": sender, "content": message})


        llm_output_raw = self.llm.chat.completions.create(
            messages=message_history,
            max_tokens=100,
            temperature=0,
            model="gpt-3.5-turbo",
            extra_body={
            "repetition_penalty": 1.15,
            "stopping_strings": ["user", "assistant", "\n", "User", "Assistant"]
            }
        ).choices[0].message.content

        # Clean up the output
        llm_output = llm_output_raw.strip().replace("\\n", "\n").replace("Assistant:", "").replace("<assistant>", "")

        return llm_output


def calculate_similarity(rank_df, embedding_task, embeddings_distractions, embeddings_related_content, embedding_model):
    # embed the page content and calculate similarity compared to user info
    embedding_title_domain = embedding_model.embed([rank_df["title"].iloc[0].lower() + " " + rank_df["domain"].iloc[0].lower()])[0]

    # calculate similarity scores between the embeddings of the page info and the user info
    similarity_task = [util.cos_sim(embedding, embedding_title_domain) for embedding in embedding_task.values()]
    similarities_distractions = [util.cos_sim(embedding, embedding_title_domain) for embedding in embeddings_distractions.values()]
    similarities_related_content = [util.cos_sim(embedding, embedding_title_domain) for embedding in embeddings_related_content.values()]
    
    # take the maximum similarity of each list of keywords
    try:
        rank_df["similarity_website_task"] = np.max(similarity_task)
        rank_df["similarity_website_distractions"] = np.max(similarities_distractions)
        rank_df["similarity_website_related_content"] = np.max(similarities_related_content)
    except ValueError as e:
        print(e)

    # calculate overall similarity rating based on the individual similarities
    rank_df['similarity_rating'] = ((rank_df["similarity_website_task"] + rank_df["similarity_website_related_content"] - rank_df["similarity_website_distractions"] + 1) / 2)

    return rank_df


def calculate_average_similarity(row, conn, window_length=10):
    # average similarity_rating over a time window
    start_time = row["time"] - pd.Timedelta(minutes=window_length)
    end_time = row["time"] + pd.Timedelta(seconds=1)

    # query the database for the similarity ratings within the time window
    query = "SELECT time, similarity_rating FROM history WHERE time > ? and time <= ?"
    avg_df = pd.read_sql(query, conn, params=(start_time.strftime("%Y-%m-%d %H:%M:%S"), end_time.strftime("%Y-%m-%d %H:%M:%S")))
    avg_df["time"] = pd.to_datetime(avg_df["time"])
    avg_df = avg_df.sort_values("time", ascending=False)

    # if there are not enough entries or the time difference between the first two entries is less than 15 seconds, return NaN
    if len(avg_df) < 2 or (len(avg_df) < 4 and (avg_df["time"].iloc[0] - avg_df["time"].iloc[1]).total_seconds() < 15):
        return np.nan
    
    # Calculate the time difference from the end_time for each row
    avg_df["time_diff"] = (end_time - avg_df["time"]).dt.total_seconds()

    # Calculate the weights based on recency to the end_time
    max_time_diff = avg_df["time_diff"].max()
    avg_df["weight"] = (max_time_diff - avg_df["time_diff"]) / max_time_diff

    # Calculate the weighted average
    weighted_sum = (avg_df["similarity_rating"] * avg_df["weight"]).sum()
    total_weight = avg_df["weight"].sum()
    weighted_average = weighted_sum / total_weight

    return weighted_average


def rate_current_tabs(df, embedding_task, embeddings_distractions, embeddings_related_content, embedding_model):
    # Calculate similarity ratings for all open tabs
    df["domain"] = df['url'].apply(lambda x: urlparse(x).netloc)
    df["similarity_rating"] = df.apply(lambda row: calculate_similarity(pd.DataFrame(row).T, embedding_task, embeddings_distractions, embeddings_related_content, embedding_model)["similarity_rating"].values[0], axis=1)
    df = df[(df["similarity_rating"] < 0.5)]
    return df


def embed_user_info(user_info, embedding_model):
    # embeds the user info
    embeddings_related_content = {}
    embeddings_distractions = {}
    embedding_task = {}

    # split the related content and common distractions keywords from the list and embed them individually
    for key, value in user_info.items():
        if key == "relatedContent" or key == "commonDistractions":
            values = value.split(", ")
            for val in values:
                if key == "relatedContent":
                    embeddings_related_content[val] = embedding_model.model.encode([val.lower()])
                elif key == "commonDistractions":
                    embeddings_distractions[val] = embedding_model.embed([val.lower()])

        elif key == "task":
            embedding_task[value] = embedding_model.embed([str(value.lower())])
    return embedding_task, embeddings_related_content, embeddings_distractions


def get_program_name(content):
    # get the name of the currently active program
    window = win32gui.GetForegroundWindow()
    _, pid = win32process.GetWindowThreadProcessId(window)
    if content == "name":
        return psutil.Process(pid).exe().split('\\')[-2]
    elif content == "title":
        return pyautogui.getActiveWindowTitle(), str(psutil.Process(pid).exe())


def is_browser_window(proc):
    # check if the current process is a browser
    if any(browser_name in proc.lower() for browser_name in ['chrome.exe', 'firefox.exe', 'msedge.exe', 'opera.exe']):
        return True
    else: 
        return False
