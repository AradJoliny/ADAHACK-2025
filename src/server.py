from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import base64
from PIL import Image
import io
from transformers import pipeline

app = Flask(__name__)
CORS(app)  # allow calls from the extension during development

# Initialize the AI model once when server starts
print("Loading AI model...")
captioner = pipeline("image-to-text", model="Salesforce/blip-image-captioning-base")
print("AI model loaded successfully!")

@app.route('/caption', methods=['POST'])
def caption():
    data = request.get_json() or {}
    image_url = data.get('image_url')
    
    if not image_url:
        return jsonify({'ok': False, 'error': 'missing image_url'}), 400

    try:
        print(f"Processing image: {image_url}")
        
        # Fetch image server-side (avoid CORS issues)
        r = requests.get(image_url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
        r.raise_for_status()
        
        # Convert to PIL Image
        image = Image.open(io.BytesIO(r.content))
        
        # Generate caption using AI
        result = captioner(image)
        final_caption = result[0]['generated_text']
        
        print(f"Generated caption: {final_caption}")
        
        return jsonify({'ok': True, 'caption': final_caption}), 200
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    print("Starting server on http://127.0.0.1:8000")
    app.run(host='127.0.0.1', port=8000, debug=True)