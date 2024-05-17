from utils import *
import traceback

db = MindfulDB("mindful.db")
db.create_db()
embedding_model = EmbeddingModel()
llm = LLM()

async def handler(websocket, path):
    # initialize variables
    ADDON_ENABLED = True
    previous_window, proc = get_program_name("title")
    previous_user_info = db.get_user_info()
    embedding_task, embeddings_related_content, embeddings_distractions = embed_user_info(previous_user_info, embedding_model)
    last_db_update = pd.Timestamp.now()

    # handshake the client on connect
    await websocket.send(json.dumps({'user_info': previous_user_info, "connectionEstablished": True}))

    try:
        # continuously loop to receive messages from the client and check if the current window changes
        while True:
            try:
                previous_url = db.get_current_content("url")
            except TypeError:
                previous_url = None

            current_window, proc = get_program_name("title")
            
            # always proceed if the window is a browser window. For other windows, only proceed if the window is different to the previous one
            if current_window in ["Task Switching", "", previous_window, None] and not is_browser_window(proc):
                await asyncio.sleep(0.1)

            else:
                # Check if the current window is a browser to await messages from the client
                if not is_browser_window(proc):
                    data = {"url": current_window, "title": current_window}

                # Wait for messages from the client or timeouts
                else:
                    try:
                        message = await asyncio.wait_for(asyncio.shield(websocket.recv()), timeout=None)
                        data = json.loads(message)
                    except Exception as e:
                        await asyncio.sleep(0.1)
                        continue
            

                # Check if the addon is enabled or disabled. Currently always on.
                if "addonEnabled" in data and data["addonEnabled"] == False:
                    ADDON_ENABLED = False
                    continue
                elif "addonEnabled" in data and data["addonEnabled"] == True:
                    ADDON_ENABLED = True

                # Handshake on request
                if "message" in data and data["message"] == "requestingConnection":
                    await websocket.send(json.dumps({"connectionEstablished": True}))
                    print("Connecting...")
                    continue

                # Check if timing for the self-report popup is due
                if "message" in data and data["message"] == "checkSelfReportTiming":
                    self_report_timing = db.check_self_report_timing()
                    if self_report_timing:
                        await websocket.send(json.dumps({'SelfReportPopup': True}))
                    continue

                # Send the user info to the client
                if "message" in data and data["message"] == "getUserInfo":
                    user_info = db.get_user_info()
                    await websocket.send(json.dumps({'user_info': user_info}))
                    continue

                # Get llm suggestions for keywords and send them to the client
                if "message" in data and data["message"] == "suggestKeywords":
                    task = data.get('task')
                    keywords = llm.predict_keywords(task)
                    await websocket.send(json.dumps({'keywordSuggestions': keywords}))
                    continue

                # Get llm suggestions for relevant content and send them to the client
                if "message" in data and data["message"] == "suggestRelevantContent":
                    user_info = db.get_user_info()
                    task = user_info.get("task")
                    related_content = user_info.get("relatedContent")

                    current_website, _ = db.get_current_content("title")
                    llm_message = llm.suggest_relevant_content(task, related_content, current_website)
                    await websocket.send(json.dumps({'LLMMessage': llm_message}))
                    continue

                # Facilitate the conversation with the LLM
                if "message" in data and data["message"] == "sendLLMMessage":
                    user_info = db.get_user_info()
                    task = user_info.get("task")
                    related_content = user_info.get("relatedContent")
                    common_distractions = user_info.get("commonDistractions")

                    llm_message = llm.conversation(data["conversation"], task, related_content, common_distractions)
                    await websocket.send(json.dumps({'LLMMessage': llm_message}))
                    continue

                # Arbitrary interaction for development purposes
                if "message" in data and data["message"] == "demoButton":
                    continue

                # Identify distracting tabs and send the indices to the client
                if "message" in data and data["message"] == "identifyDistractingTabs":
                    current_content_active = pd.DataFrame({"title": data["titles"], "url": data["urls"], "tab_index": data["indices"]})
                    recent_content = rate_current_tabs(current_content_active, embedding_task, embeddings_distractions, embeddings_related_content, embedding_model)

                    distracting_indices = [int(index) for index in recent_content["tab_index"].values]
                    await websocket.send(json.dumps({'distractingIndices': distracting_indices, "openInterventionWindow": data["openInterventionWindow"]}))
                    continue


                # Update the user info in the database and re-embed the user info
                if "message" in data and data["message"] == "updateUserInfo":
                    user_info = data.get('user_info')
                    db.write_back_user_info(user_info)
                    if last_db_update < pd.Timestamp.now() - pd.Timedelta(seconds=3):
                        continue
                    embedding_task, embeddings_related_content, embeddings_distractions = embed_user_info(user_info, embedding_model)
                    previous_user_info = user_info
                    last_db_update = pd.Timestamp.now()
                    continue

                # Update the study info in the database
                if "message" in data and data["message"] == "updateStudyInfo":
                    study_info = data.get('study_info')
                    interventionSchedule = db.write_back_study_info(study_info, data.get('themeIntervention'))
                    await websocket.send(json.dumps({'studyInfoSet': "", "interventionSchedule": interventionSchedule}))
                    continue

                # Test the LLM connection
                if "message" in data and data["message"] == "testLlm":
                    print("Testing LLM connection")
                    llm_test_message = llm.test_connection()
                    await websocket.send(json.dumps({'testLlm': llm_test_message}))
                    continue

                # Export the telemetry data
                if "message" in data and data["message"] == "nextInterventionStage":
                    db.telemetry_export(data.get('currentIntervention'), data.get('nextIntervention'))
                    continue

                # Write intervention tracking data to the database
                if "message" in data and data["message"] in ["listTrackingData", "chatbotTrackingData"]:
                    if data["message"] == "listTrackingData":
                        db.write_back_tracking_data("list", data.get('listTrackingData'))
                    elif data["message"] == "chatbotTrackingData":
                        db.write_back_tracking_data("chatbot", data.get('chatbotTrackingData'))
                    continue

                # Write self-report data to the database
                if "message" in data and data["message"] == "selfReport":
                    db.write_back_self_report(data)
                    continue


                # only process the data if the addon is enabled, the data is not empty and the last update was more than 300ms ago
                if "title" in data and ADDON_ENABLED:
                    
                    url = data.get('url')

                    user_info = data.get('user_info', previous_user_info)

                    # temporary dataframe to store the data
                    rank_df = pd.DataFrame([{"time": pd.Timestamp.now(), 'url': url}])

                    # Fill in the domain and title data for non-browser windows
                    if not is_browser_window(proc):
                        rank_df["domain"] = get_program_name("name")
                        rank_df["title"], _ = get_program_name("title")
                    else:
                        rank_df["title"] = data.get('title')
                        try:
                            rank_df["domain"] = rank_df['url'].apply(lambda x: urlparse(x).netloc)
                        except:
                            rank_df["domain"] = ""

                    try:
                        rank_df = calculate_similarity(rank_df, embedding_task, embeddings_distractions, embeddings_related_content, embedding_model)
                        rank_df["similarity_rating_avg"] = calculate_average_similarity(rank_df.iloc[0], db.conn, window_length=10)

                        #round scores to 3 decimal places
                        rank_df["similarity_rating"] = rank_df["similarity_rating"].astype(float).round(3)
                        rank_df["similarity_rating_avg"] = rank_df["similarity_rating_avg"].astype(float).round(3)

                    except Exception:
                        print(traceback.format_exc())
                        continue
                    
                    # Don't write back if the window is the same as the previous one
                    if last_db_update < pd.Timestamp.now() - pd.Timedelta(milliseconds=300) and url != previous_url:
                        previous_url = url
                        last_db_update = pd.Timestamp.now()
                        db.write_back_scores(rank_df)
                        

                    # Send the rating to the client if the browser is active, otherwise wait for the browser to become active
                    await websocket.send(json.dumps({'rating': str(rank_df["similarity_rating"].iloc[0]), "type": "relevant" if is_browser_window(proc) else "irrelevant", "mean_rating": str(rank_df["similarity_rating_avg"].iloc[0])}))
                    previous_window = current_window

            previous_window = current_window

    except:
        pass #print(traceback.format_exc())

async def start_server():
    WEBSOCKET_PORT = 8765
    async with websockets.serve(handler, "localhost", WEBSOCKET_PORT):
        print(f"WebSocket server started on port {WEBSOCKET_PORT}")
        await asyncio.Event().wait()  # Wait indefinitely for manual interruption

async def main():
    # Loop to handle reconnection in case of an error
    while True:
        try:
            await start_server()

        except Exception as e:
            print(traceback.format_exc())
            print("Attempting to reconnect in 5 seconds...")
            await asyncio.sleep(5)
            continue 

if __name__ == "__main__":
    asyncio.run(main())