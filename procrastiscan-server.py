import asyncio
import websockets
import json
import pywinctl
import traceback


# Get the active window's name and title
def get_program_info():
    try:
        window = pywinctl.getActiveWindow()
        name = window.getAppName()

        # remove file extension
        name = name.split(".")[0]
        title = window.title
        return name, title
    except AttributeError as e:
        print(f"Error getting program info: {e}")
        return "", ""

# WebSocket server handler
async def handler(websocket):
    previous_name, previous_title = get_program_info()
    browser_names = ["firefox", "chrome", "edge", "opera", "brave", "vivaldi", "safari", "msedge"]

    #get the browser name by checking the program when the connection is first established
    message = await asyncio.wait_for(asyncio.shield(websocket.recv()), timeout=None)
    if message:
        await websocket.send(json.dumps({"message": "connectionEstablished"}))
        browser_name, _ = get_program_info()

        # fetch the browser name until a valid browser is detected
        while browser_name.lower() not in browser_names:
            browser_name, _ = get_program_info()
            await asyncio.sleep(0.1)

    try:
        # continuously loop to send messages to the extension client if the current window changes
        while True:
            current_name, current_title = get_program_info()
            if current_name in ["Task Switching", "", None] or current_name in browser_names or current_title in ["Task Switching", "", previous_title, None]:
                await asyncio.sleep(0.2)

            else:
                # Send the rating to the client if the browser is active, otherwise wait for the browser to become active
                await websocket.send(json.dumps({"programInfo": {"name": current_name, "title": current_title}}))

            previous_name, previous_title = current_name, current_title

    except:
        print(f"Error: {traceback.format_exc()}")

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