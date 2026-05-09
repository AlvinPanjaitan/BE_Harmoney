# Harmoney Back-End Project

Harmoney is a split bill back-end system designed to help users scan receipts, manage friends, assign purchased items, and calculate bill distribution automatically.

This project uses a combination of NestJS as the main API server and a Python OCR service for receipt scanning and text extraction.

---

# Main Features

- Receipt scanning using OCR
- Upload receipt image from camera or local file
- Automatic extraction of item names and prices
- Split bill session management
- Add and manage friends in a session
- Automatic assignment for the session owner ("me")
- Manual item editing
- Manual item addition
- Bill calculation and item assignment

---

# Architecture

This project is divided into two services:

## 1. NestJS Backend (`harmoney-be`)
Responsible for:
- Main REST API
- Session management
- Friend management
- Item management
- Bill calculation
- Communication with OCR service

### Technologies
- NestJS
- TypeScript
- Multer

---

## 2. Python OCR Service (`harmoney-ocr`)
Responsible for:
- Receipt image processing
- OCR text extraction
- Detecting item names and prices from receipts

### Technologies
- Python
- Flask
- OCR Processing

---

# Project Structure

```bash
BE_HARMONEY/
├── harmoney-be/      # NestJS Backend
├── harmoney-ocr/     # Python OCR Service
└── README.md
```

---

# API Flow

1. User uploads receipt image
2. NestJS backend sends image to Python OCR service
3. OCR service extracts receipt data
4. Extracted items are returned to NestJS
5. Backend creates split bill session
6. Users can add friends and assign items
7. Backend calculates final bill result

---

# How to Run

## Run NestJS Backend

```bash
cd harmoney-be
npm install
npm run start:dev
```

Backend runs on:

```bash
http://localhost:3000
```

---

## Run Python OCR Service

```bash
cd harmoney-ocr
pip install -r requirements.txt
python app.py
```

OCR service runs on:

```bash
http://127.0.0.1:5000
```

---

# Notes

Both services must run simultaneously for the receipt scanning feature to work correctly.

Environment variables are stored using `.env` files and are excluded from Git tracking using `.gitignore`.