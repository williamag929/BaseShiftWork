# Webhook Integration Guide

## Overview

ShiftWork automatically sends webhook notifications to external systems (e.g., Zapier, Procore) when employees or locations are created or updated. This enables real-time synchronization with third-party platforms.

## Supported Events

The following events trigger webhook notifications:

| Event Type | Trigger | Description |
|------------|---------|-------------|
| `employee.created` | POST `/api/companies/{companyId}/people` | Triggered when a new employee (Person) is created |
| `employee.updated` | PUT `/api/companies/{companyId}/people/{personId}` | Triggered when an employee (Person) is updated |
| `location.created` | POST `/api/companies/{companyId}/locations` | Triggered when a new location is created |
| `location.updated` | PUT `/api/companies/{companyId}/locations/{locationId}` | Triggered when a location is updated |

## Configuration

### Environment Variables

Set the following environment variables in your deployment:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ZAPIER_WEBHOOK_URL` | Yes | None | The webhook endpoint URL (e.g., Zapier webhook URL) |
| `WEBHOOK_SECRET_KEY` | No | `default-secret-key` | Secret key used for HMAC SHA256 signature generation |

### Example Configuration (Windows PowerShell)

```powershell
$env:ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/12345/abcde/"
$env:WEBHOOK_SECRET_KEY = "your-secret-key-here"
```

### Example Configuration (Linux/Mac)

```bash
export ZAPIER_WEBHOOK_URL="https://hooks.zapier.com/hooks/catch/12345/abcde/"
export WEBHOOK_SECRET_KEY="your-secret-key-here"
```

### Example Configuration (.env file)

```env
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/12345/abcde/
WEBHOOK_SECRET_KEY=your-secret-key-here
```

## Webhook Payload Structure

All webhooks follow a standardized JSON structure:

```json
{
  "eventType": "employee.created",
  "timestamp": "2025-11-05T14:30:00Z",
  "data": {
    // Full employee or location DTO object
  }
}
```

### Employee Created/Updated Payload Example

```json
{
  "eventType": "employee.created",
  "timestamp": "2025-11-05T14:30:00.000Z",
  "data": {
    "personId": 42,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "companyId": "acme-123",
    "phoneNumber": "+1234567890",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "status": "Active",
    "statusShiftWork": null,
    "photoUrl": "https://s3.amazonaws.com/bucket/photo.jpg",
    "roleId": 5,
    "externalCode": "EMP-001"
  }
}
```

### Location Created/Updated Payload Example

```json
{
  "eventType": "location.created",
  "timestamp": "2025-11-05T14:30:00.000Z",
  "data": {
    "locationId": 10,
    "name": "Construction Site A",
    "companyId": "acme-123",
    "address": "456 Site Rd",
    "city": "Brooklyn",
    "state": "NY",
    "country": "USA",
    "zipCode": "11201",
    "geoCoordinates": "40.6782,-73.9442",
    "phoneNumber": "+1234567891",
    "email": "site-a@example.com",
    "timeZone": "America/New_York",
    "status": "Active",
    "externalCode": "LOC-001"
  }
}
```

## Security

### HMAC SHA256 Signature

Each webhook request includes an `X-ShiftWork-Signature` header containing an HMAC SHA256 signature for verification.

**Signature Generation:**
1. The payload JSON is serialized (camelCase formatting)
2. HMAC SHA256 hash is computed using the `WEBHOOK_SECRET_KEY`
3. The hash is Base64-encoded and included in the header

**Signature Verification Example (Node.js):**

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(payload);
  const expectedSignature = hmac.digest('base64');
  
  return signature === expectedSignature;
}

// In your webhook handler
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-shiftwork-signature'];
  const payload = JSON.stringify(req.body);
  const secretKey = process.env.WEBHOOK_SECRET_KEY;
  
  if (!verifyWebhookSignature(payload, signature, secretKey)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook...
  res.status(200).json({ success: true });
});
```

## Retry Logic

The webhook service implements automatic retry logic:

- **Maximum Retries:** 3 attempts
- **Backoff Strategy:** Exponential backoff (1s, 2s, 3s)
- **Success Criteria:** HTTP 2xx response status
- **Failure Handling:** Logged but does not block the API request

## Zapier Integration

### Setup Zapier Webhook

1. Log in to [Zapier](https://zapier.com/)
2. Create a new Zap
3. Choose "Webhooks by Zapier" as the trigger
4. Select "Catch Hook"
5. Copy the webhook URL provided by Zapier
6. Set the `ZAPIER_WEBHOOK_URL` environment variable with this URL

### Filter Events in Zapier

Use Zapier's built-in filters to handle specific event types:

- **Filter by Event Type:** Add a filter step checking `eventType` equals `employee.created`
- **Path Routing:** Use Zapier Paths to route different event types to different actions

### Example Zap: Employee Created → Procore

1. **Trigger:** Webhooks by Zapier (Catch Hook)
2. **Filter:** Only continue if `eventType` is `employee.created`
3. **Action:** Procore - Create Worker
   - Map `data.name` to Worker Name
   - Map `data.email` to Worker Email
   - Map `data.phoneNumber` to Worker Phone

## Procore Field Mapping

When syncing employees to Procore, map the following fields:

| ShiftWork Field | Procore Field | Notes |
|-----------------|---------------|-------|
| `data.name` | Worker Name | Required |
| `data.email` | Email Address | Required, must be unique |
| `data.phoneNumber` | Phone Number | Optional |
| `data.externalCode` | Employee ID | Optional, for reference |
| `data.status` | Status | Map "Active" to Active, others to Inactive |

When syncing locations to Procore projects:

| ShiftWork Field | Procore Field | Notes |
|-----------------|---------------|-------|
| `data.name` | Project Name | Required |
| `data.address` | Address Line 1 | Optional |
| `data.city` | City | Optional |
| `data.state` | State/Province | Optional |
| `data.zipCode` | Postal Code | Optional |
| `data.externalCode` | Project Number | Optional |

## Monitoring

### Checking Webhook Logs

Webhook send attempts and failures are logged in the application logs:

```
[Information] Webhook sent successfully for event EmployeeCreated on attempt 1.
[Warning] Webhook failed for event EmployeeCreated with status 500 on attempt 1. Response: ...
[Error] Webhook failed for event EmployeeCreated after 3 attempts.
```

### Troubleshooting

**Webhooks not being sent:**
- Verify `ZAPIER_WEBHOOK_URL` is configured
- Check application logs for errors
- Ensure the webhook endpoint is accessible from your server

**Signature verification failures:**
- Confirm `WEBHOOK_SECRET_KEY` matches on both sides
- Verify the payload is not modified before verification
- Check that the signature is extracted from the `X-ShiftWork-Signature` header

**Webhook endpoint returns non-200 status:**
- Check the endpoint logs for errors
- Verify the payload structure matches expectations
- Test the endpoint with a sample payload using curl or Postman

## Testing

### Manual Testing with curl

```bash
curl -X POST https://hooks.zapier.com/hooks/catch/12345/abcde/ \
  -H "Content-Type: application/json" \
  -H "X-ShiftWork-Signature: <base64-signature>" \
  -d '{
    "eventType": "employee.created",
    "timestamp": "2025-11-05T14:30:00Z",
    "data": {
      "personId": 42,
      "name": "Test Employee",
      "email": "test@example.com",
      "companyId": "test-company"
    }
  }'
```

### Disabling Webhooks for Testing

If `ZAPIER_WEBHOOK_URL` is not set, webhooks will be logged but not sent, allowing you to develop and test without triggering external systems.

## Support

For issues or questions about webhook integration:

1. Check the application logs for detailed error messages
2. Verify environment variables are set correctly
3. Test the webhook endpoint independently with sample payloads
4. Review Zapier task history for webhook delivery status
