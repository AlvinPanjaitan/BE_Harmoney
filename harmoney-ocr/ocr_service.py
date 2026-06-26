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
    You are an expert receipt parser with advanced accounting logic perception.

    IMPORTANT:
    - OCR TEXT is PRIMARY source.
    - IMAGE is fallback only.
    - DO NOT hallucinate values.
    - ONLY return valid JSON.

    CRITICAL UNIT & QUANTITY PARSING RULES:
    Look closely at how quantities and units are written. DO NOT mistake product volume/packaging units (like "ml", "gr", "lusin", "pack", "pcs") as the item quantity ('qty').
    
    Case 1 (Packaging/Volume Units): 
    - Example: "1 500 ml x 7,000" -> This means 1 bottle of 500ml priced at 7,000. 
      CORRECT: 'qty' = 1, 'price' = 7000, 'portion_price' = 7000.
      WRONG: 'qty' = 500, 'price' = 7.
      
    Case 2 (Bundle Units like 'lusin'):
    - Example: "1 lusin x 36,000" -> This means 1 bundle/pack of a dozen priced at 36,000 total for that pack.
      CORRECT: 'qty' = 1, 'price' = 36000, 'portion_price' = 36000.
      WRONG: 'qty' = 12, 'price' = 3000. (Unless the receipt explicitly shows 12 x 3,000).

    CRITICAL PRICE LOGIC DETECTION INSTRUCTIONS:
    Analyze the receipt format. Determine which format this receipt uses before populating 'price' and 'portion_price':
    Format A (Unit Price Printed): The number listed next to the item is for ONE single unit. 
    Format B (Portion Price Printed): The number listed next to the item is ALREADY the TOTAL price for that row.
    Cross-check mathematically: ('qty' * 'price') MUST ALWAYS equal 'portion_price'.

    GENERAL RULES:
    1. merchant_name: Extract the store name from the top (e.g., "Karis Jaya Shop").
    2. transaction_date: Convert to ISO 8601 (YYYY-MM-DDTHH:mm:ssZ).
    3. total_price: Extract the final absolute total bill paid at the bottom (e.g., 70000). DO NOT use Sub Total.
    4. items: Extract all active lines. Include Tax, Service Charge, or Rounding as separate items. DO NOT include "Sub Total" or "Total" inside this list.

    OCR TEXT:
    {ocr_text}

    STRICT JSON OUTPUT FORMAT:

    {{
      "merchant_name": "",
      "transaction_date": "",
      "total_price": 0,
      "items": [
        {{
          "name": "",
          "price": 0,
          "qty": 1,
          "portion_price": 0
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



@app.route("/api/scan-receipt", methods=["POST"])
def scan_receipt():

    try:

        if "image" not in request.files:
            return jsonify({
                "error": "No image uploaded"
            }), 400

        file = request.files["image"]

        image_bytes = file.read()

        ocr_result = extract_ocr(image_bytes)

        ai_response = analyze_receipt(
            image_bytes=image_bytes,
            ocr_text=ocr_result["raw_text"]
        )

        formatted_items = []
        for index, item in enumerate(ai_response.get("items", []), start=1):
            formatted_items.append({
                "item_id": index,
                "name": item.get("name"),
                "portion_price": item.get("portion_price"),
                "price": item.get("price"),
                "qty": item.get("qty")
            })

        final_response = {
            "msg": "OCR Scan successful",
            "data": {
                "merchant_name": ai_response.get("merchant_name"),
                "transaction_date": ai_response.get("transaction_date"),
                "total_price": ai_response.get("total_price"),
                "items": formatted_items
            }
        }

        return jsonify(final_response), 200

    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port, debug=False)