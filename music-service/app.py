import os
import time
import logging
import io
from flask import Flask, request, jsonify, send_file
import yt_dlp

# Inject Deno bin directory to path for yt-dlp challenge solving
os.environ["PATH"] += os.pathsep + os.path.expanduser("~/.deno/bin")

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/download', methods=['GET'])
def download():
    url = request.args.get('url')
    codec = request.args.get('codec', 'mp3')
    
    if not url:
        return jsonify({"error": "Missing url parameter"}), 400
        
    if codec not in ['mp3', 'opus']:
        codec = 'mp3'

    logger.info(f"Received download request for URL: {url} with codec: {codec}")
    
    unique_id = f"audio_{os.getpid()}_{int(time.time() * 1000)}"
    output_tmpl = os.path.join(TEMP_DIR, unique_id + ".%(ext)s")
    
    # yt-dlp outputs .opus for 'opus' codec, and .mp3 for 'mp3' codec
    ext = 'opus' if codec == 'opus' else 'mp3'
    final_filepath = os.path.join(TEMP_DIR, f"{unique_id}.{ext}")

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_tmpl,
        # Uncomment these lines if deploying to a VPS (e.g., AWS) to bypass IP bans using OAuth2:
        # 'username': 'oauth2',
        # 'password': '',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': codec,
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"Starting yt-dlp download for codec {codec}...")
            ydl.download([url])
            logger.info("Download and post-processing completed.")

        if not os.path.exists(final_filepath):
            logger.error(f"Expected file was not found: {final_filepath}")
            return jsonify({"error": "Failed to extract audio file"}), 500

        # Read file into memory to avoid file lock issues on Windows during send_file
        with open(final_filepath, 'rb') as f:
            file_data = f.read()

        # Delete the file immediately from disk now that we have it in memory
        try:
            os.remove(final_filepath)
            logger.info(f"Cleaned up temporary file from disk: {final_filepath}")
        except Exception as cleanup_err:
            logger.error(f"Failed to delete temporary file: {cleanup_err}")

        # Set correct mimetype for Baileys/WhatsApp rendering
        if codec == 'opus':
            mimetype = "audio/ogg; codecs=opus"
        else:
            mimetype = "audio/mpeg"

        logger.info(f"Streaming {len(file_data)} bytes in response with mimetype {mimetype}")
        return send_file(
            io.BytesIO(file_data),
            mimetype=mimetype,
            as_attachment=True,
            download_name=f"audio.{ext}"
        )

    except Exception as e:
        logger.error(f"Error occurred during download/processing: {e}")
        # Cleanup any leftover files
        for possible_ext in ['.mp3', '.opus', '.webm', '.m4a', '.mp4']:
            possible_file = os.path.join(TEMP_DIR, unique_id + possible_ext)
            if os.path.exists(possible_file):
                try:
                    os.remove(possible_file)
                except:
                    pass
        return jsonify({"error": str(e)}), 500

@app.route('/download_video', methods=['GET'])
def download_video():
    url = request.args.get('url')
    if not url:
        return jsonify({"error": "Missing url parameter"}), 400

    logger.info(f"Received video download request for URL: {url}")
    
    unique_id = f"video_{os.getpid()}_{int(time.time() * 1000)}"
    output_tmpl = os.path.join(TEMP_DIR, unique_id + ".%(ext)s")
    final_filepath = os.path.join(TEMP_DIR, f"{unique_id}.mp4")

    ydl_opts = {
        'format': '22/18/best[ext=mp4]/best',
        'outtmpl': output_tmpl,
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info("Starting yt-dlp video download...")
            ydl.download([url])
            logger.info("Video download completed.")

        if not os.path.exists(final_filepath):
            found = False
            for f in os.listdir(TEMP_DIR):
                if f.startswith(unique_id) and f.endswith('.mp4'):
                    final_filepath = os.path.join(TEMP_DIR, f)
                    found = True
                    break
            if not found:
                logger.error(f"Expected video file was not found: {final_filepath}")
                return jsonify({"error": "Failed to extract video file"}), 500

        with open(final_filepath, 'rb') as f:
            file_data = f.read()

        try:
            os.remove(final_filepath)
            logger.info(f"Cleaned up temporary video: {final_filepath}")
        except Exception as cleanup_err:
            logger.error(f"Failed to delete temporary video: {cleanup_err}")

        return send_file(
            io.BytesIO(file_data),
            mimetype="video/mp4",
            as_attachment=True,
            download_name="video.mp4"
        )

    except Exception as e:
        logger.error(f"Error occurred during video download/processing: {e}")
        for possible_ext in ['.mp4', '.mkv', '.webm', '.m4a']:
            possible_file = os.path.join(TEMP_DIR, unique_id + possible_ext)
            if os.path.exists(possible_file):
                try:
                    os.remove(possible_file)
                except:
                    pass
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5005, debug=False)
