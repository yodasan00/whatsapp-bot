import os
import time
import logging
import io
import urllib.request
import json
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

def get_cookies_path():
    root_cookies = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cookies.txt")
    if os.path.exists(root_cookies):
        return root_cookies
    service_cookies = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cookies.txt")
    if os.path.exists(service_cookies):
        return service_cookies
    return None

def try_cobalt_fallback(url, download_mode="audio", audio_format="mp3"):
    payload = {
        "url": url,
        "downloadMode": download_mode,
        "audioFormat": audio_format,
        "videoQuality": "720",
        "filenameStyle": "basic"
    }
    data = json.dumps(payload).encode('utf-8')
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # 1. Fetch dynamic working list of Cobalt instances from cobalt.directory
    instances = []
    try:
        logger.info("[COBALT] Fetching working instances list from cobalt.directory...")
        directory_req = urllib.request.Request(
            "https://cobalt.directory/api/working?type=api",
            headers={"User-Agent": headers["User-Agent"]}
        )
        with urllib.request.urlopen(directory_req, timeout=8) as dir_resp:
            dir_data = json.loads(dir_resp.read().decode('utf-8'))
            instances = dir_data.get("data", {}).get("youtube", [])
            logger.info(f"[COBALT] Found {len(instances)} working YouTube instances from cobalt.directory: {instances}")
    except Exception as e:
        logger.warning(f"[COBALT] Failed to fetch instances from cobalt.directory: {e}")
        
    # Fallback to hardcoded known open instances if directory fetch failed or returned empty
    if not instances:
        instances = [
            "https://api.cobalt.blackcat.sweeux.org",
            "https://rue-cobalt.xenon.zone"
        ]
    
    for instance in instances:
        api_url = instance if instance.endswith('/') else instance + '/'
        try:
            logger.info(f"[COBALT] Trying Cobalt instance: {api_url} for url: {url}")
            req = urllib.request.Request(api_url, data=data, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=15) as response:
                if response.status == 200:
                    resp_data = json.loads(response.read().decode('utf-8'))
                    if "url" in resp_data:
                        stream_url = resp_data["url"]
                        logger.info(f"[COBALT] Success! Streaming from URL: {stream_url}")
                        
                        stream_req = urllib.request.Request(stream_url, headers={"User-Agent": headers["User-Agent"]})
                        with urllib.request.urlopen(stream_req, timeout=45) as stream_response:
                            if stream_response.status == 200:
                                return stream_response.read()
            logger.warning(f"[COBALT] Instance {api_url} returned non-200 or no URL")
        except urllib.error.HTTPError as he:
            try:
                err_body = he.read().decode('utf-8')
            except:
                err_body = "could not read body"
            logger.warning(f"[COBALT] Instance {api_url} failed with HTTPError {he.code}: {err_body}")
        except Exception as e:
            logger.warning(f"[COBALT] Instance {api_url} failed: {e}")
            
    return None

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.errorhandler(Exception)
def handle_exception(e):
    import traceback
    logger.error(f"Unhandled Exception: {e}\n{traceback.format_exc()}")
    return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500

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
        'extractor_args': {
            'youtube': {
                'player_client': ['ios', 'android']
            }
        },
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': codec,
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
    }

    cookies_path = get_cookies_path()
    if cookies_path:
        ydl_opts['cookiefile'] = cookies_path
        logger.info(f"Loaded yt-dlp cookies from: {cookies_path}")

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
        logger.error(f"Error occurred during download/processing: {e}. Trying Cobalt fallback...")
        try:
            cobalt_data = try_cobalt_fallback(url, download_mode="audio", audio_format=codec)
            if cobalt_data:
                mimetype = "audio/ogg; codecs=opus" if codec == 'opus' else "audio/mpeg"
                logger.info(f"Streaming {len(cobalt_data)} bytes from Cobalt fallback with mimetype {mimetype}")
                return send_file(
                    io.BytesIO(cobalt_data),
                    mimetype=mimetype,
                    as_attachment=True,
                    download_name=f"audio.{ext}"
                )
        except Exception as fallback_err:
            logger.error(f"Cobalt fallback failed: {fallback_err}")

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
    output_tmpl = os.path.join(TEMP_DIR, unique_id + "_raw.%(ext)s")
    transcoded_filepath = os.path.join(TEMP_DIR, f"{unique_id}_compatible.mp4")

    ydl_opts = {
        'format': '22/18/best[ext=mp4]/best',
        'outtmpl': output_tmpl,
        'extractor_args': {
            'youtube': {
                'player_client': ['ios', 'android']
            }
        },
        'quiet': True,
        'no_warnings': True,
    }

    cookies_path = get_cookies_path()
    if cookies_path:
        ydl_opts['cookiefile'] = cookies_path
        logger.info(f"Loaded yt-dlp cookies from: {cookies_path}")

    # Helper function to transcode using FFmpeg
    def transcode(in_path, out_path):
        import subprocess
        cmd = [
            "ffmpeg", "-y",
            "-i", in_path,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-movflags", "+faststart",
            out_path
        ]
        logger.info(f"[TRANSCODE] Running command: {' '.join(cmd)}")
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode == 0:
                logger.info("[TRANSCODE] Transcoding successful.")
                return True
            else:
                logger.error(f"[TRANSCODE] FFmpeg returned non-zero code {res.returncode}. stderr: {res.stderr.decode('utf-8', errors='ignore')}")
        except Exception as ex:
            logger.error(f"[TRANSCODE] Failed to run FFmpeg: {ex}")
        return False

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info("Starting yt-dlp video download...")
            ydl.download([url])
            logger.info("Video download completed.")

        # Find the raw downloaded file (regardless of extension: .mp4, .webm, etc.)
        raw_filepath = None
        for f in os.listdir(TEMP_DIR):
            if f.startswith(unique_id + "_raw"):
                raw_filepath = os.path.join(TEMP_DIR, f)
                break

        if not raw_filepath or not os.path.exists(raw_filepath):
            logger.error("Expected raw video file was not found.")
            return jsonify({"error": "Failed to extract video file"}), 500

        # Transcode to compatible format
        success = transcode(raw_filepath, transcoded_filepath)
        
        # Read the file to send
        file_to_send = transcoded_filepath if (success and os.path.exists(transcoded_filepath)) else raw_filepath
        with open(file_to_send, 'rb') as f:
            file_data = f.read()

        # Cleanup
        try:
            if os.path.exists(raw_filepath):
                os.remove(raw_filepath)
            if os.path.exists(transcoded_filepath):
                os.remove(transcoded_filepath)
            logger.info("Cleaned up temporary video files from disk.")
        except Exception as cleanup_err:
            logger.error(f"Failed to delete temporary video files: {cleanup_err}")

        return send_file(
            io.BytesIO(file_data),
            mimetype="video/mp4",
            as_attachment=True,
            download_name="video.mp4"
        )

    except Exception as e:
        logger.error(f"Error occurred during video download/processing: {e}. Trying Cobalt fallback...")
        try:
            cobalt_data = try_cobalt_fallback(url, download_mode="auto")
            if cobalt_data:
                logger.info(f"Downloaded {len(cobalt_data)} bytes from Cobalt video fallback. Saving to raw file...")
                raw_cobalt_path = os.path.join(TEMP_DIR, f"{unique_id}_cobalt_raw")
                with open(raw_cobalt_path, 'wb') as f:
                    f.write(cobalt_data)
                
                success = transcode(raw_cobalt_path, transcoded_filepath)
                file_to_send = transcoded_filepath if (success and os.path.exists(transcoded_filepath)) else raw_cobalt_path
                
                with open(file_to_send, 'rb') as f:
                    final_data = f.read()
                    
                try:
                    if os.path.exists(raw_cobalt_path):
                        os.remove(raw_cobalt_path)
                    if os.path.exists(transcoded_filepath):
                        os.remove(transcoded_filepath)
                except Exception as cleanup_err:
                    logger.error(f"Failed to clean up Cobalt fallback files: {cleanup_err}")
                    
                return send_file(
                    io.BytesIO(final_data),
                    mimetype="video/mp4",
                    as_attachment=True,
                    download_name="video.mp4"
                )
        except Exception as fallback_err:
            logger.error(f"Cobalt video fallback failed: {fallback_err}")

        # Final cleanup of any leftovers
        for possible_ext in ['_raw.mp4', '_raw.webm', '_compatible.mp4', '_cobalt_raw']:
            possible_file = os.path.join(TEMP_DIR, unique_id + possible_ext)
            if os.path.exists(possible_file):
                try:
                    os.remove(possible_file)
                except:
                    pass
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5005, debug=False)
