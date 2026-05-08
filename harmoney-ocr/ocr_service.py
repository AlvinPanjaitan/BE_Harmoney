import os
import json
import base64
import cv2
import numpy as np

from flask import Flask, request, jsonify
from dotenv import load_dotenv
from groq import Groq
from paddleocr import PaddleOCR


load_dotenv()

app = Flask(__name__)

client = Groq(
    api_key=os.environ.get("GROQ_API_KEY")
)

ocr = PaddleOCR(
    use_textline_orientation=True,
    lang='en'
)


def encode_image(image_bytes):
    return base64.b64encode(image_bytes).decode("utf-8")



def extract_ocr(image_bytes):

    img = cv2.imdecode(
        np.frombuffer(image_bytes, np.uint8),
        cv2.IMREAD_COLOR
    )

    if img is None:
        return {
            "raw_text": ""
        }

    result = ocr.ocr(img)

    texts = []

    if result:
        for block in result:

            if not block:
                continue

            for line in block:

                try:
                    content = line[1]

                    if isinstance(content, (list, tuple)):

                        text, conf = content

                        texts.append(str(text))

                except:
                    continue

    return {
        "raw_text": "\n".join(texts)
    }


def analyze_receipt(image_bytes, ocr_text):

    base64_image = encode_image(image_bytes)

    prompt = f"""
    You are an expert receipt parser.

    IMPORTANT:
    - OCR TEXT is PRIMARY source.
    - IMAGE is fallback only.
    - DO NOT hallucinate values.
    - ONLY return valid JSON.
    - ONLY extract:
      - date
      - items

    OCR TEXT:
    {ocr_text}

    For each item extract:
    - name
    - quantity
    - unit_price
    - total_price

    STRICT JSON OUTPUT:

    {{
      "date": "",
      "items": [
        {{
          "name": "",
          "quantity": 1,
          "unit_price": 0,
          "total_price": 0
        }}
      ]
    }}
    """

    completion = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        temperature=0.0,
        max_tokens=2048,
        response_format={"type": "json_object"}
    )

    response_text = completion.choices[0].message.content

    return json.loads(response_text)



@app.route("/scan-receipt", methods=["POST"])
def scan_receipt():

    try:

        if "image" not in request.files:
            return jsonify({
                "error": "No image uploaded"
            }), 400

        file = request.files["image"]

        image_bytes = file.read()

        ocr_result = extract_ocr(image_bytes)

        parsed_receipt = analyze_receipt(
            image_bytes=image_bytes,
            ocr_text=ocr_result["raw_text"]
        )

        return jsonify({
            "success": True,
            "data": parsed_receipt
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(debug=True)