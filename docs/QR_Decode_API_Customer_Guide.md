# How To: Decode an NRS ID Card QR Code

This guide explains how a customer system can read an NRS ID card QR code and obtain the employee ID (IR number).

## Overview

Each printed NRS ID card includes a QR code. Scanning that QR code produces an encrypted **token**. Your application sends that token to the NRS decode API, authenticated with an **API key**. The API returns the employee ID.

```
Scan QR code → token → POST /api/cards/qr/decode → employeeId
```

## 1. Get your API key

Ask your NRS administrator to create an API key for your integration (Settings → API Keys).

- You will receive the key **once**. Store it securely.
- Send it on every request in the `X-API-Key` header.
- If the key is revoked, decoding will fail until it is reactivated or a new key is issued.

## 2. Scan the QR code

Use your scanner or camera to read the QR code on the card.

The QR payload is a single encrypted string (the token). Pass that string as-is to the API—do not modify it.

## 3. Call the decode API

**Endpoint**

```http
POST {BASE_URL}/api/cards/qr/decode
```

**Headers**

| Header         | Value              |
|----------------|--------------------|
| `Content-Type` | `application/json` |
| `X-API-Key`    | Your API key       |

**Body**

```json
{
  "token": "<string from the QR code>"
}
```

**Example (cURL)**

```bash
curl -X POST "https://YOUR-HOST/api/cards/qr/decode" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: nrs_your_api_key_here" \
  -d '{"token":"gAAAAABh..."}'
```

**Success response (`200`)**

```json
{
  "employeeId": "12345"
}
```

`employeeId` is the employee’s IR number.

## 4. Handle errors

| Status | Meaning |
|--------|---------|
| `200`  | Token decoded successfully |
| `400`  | Missing or invalid token |
| `401`  | Missing, invalid, or revoked API key |

## Notes

- Keep your API key private. Do not embed it in public client apps or commit it to source control.
- Already-printed cards remain valid; the token format has not changed.
- Contact your NRS administrator if you need a new key or access restored after a revoke.
