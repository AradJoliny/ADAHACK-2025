from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)  # allow calls from the extension during development

@app.route('/caption', methods=['POST'])
def caption():
    data = request.get_json() or {}
    image_url = data.get('image_url')
    if not image_url:
        return jsonify({'ok': False, 'error': 'missing image_url'}), 400

    try:
        # fetch image server-side (avoid CORS issues)
        r = requests.get(image_url, timeout=10)
        r.raise_for_status()
        image_bytes = r.content

        # TODO: run your AI model on image_bytes and produce final_caption
        final_caption = f'Placeholder caption for {image_url}'

        return jsonify({'ok': True, 'caption': final_caption}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8000)