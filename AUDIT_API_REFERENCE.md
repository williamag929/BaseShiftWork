# Audit History API Quick Reference

## Base URL
```
http://localhost:5182/api/companies/{companyId}/audit-history
```

## Endpoints

### 1. Get Entity Audit History
**Endpoint:** `GET /{entityName}/{entityId}`

**Description:** Retrieves the complete audit history for a specific entity with pagination and filtering.

**Path Parameters:**
- `companyId` (string) - Company identifier
- `entityName` (string) - Entity type name (e.g., "Person", "Schedule", "Location")
- `entityId` (string) - Entity identifier

**Query Parameters:**
- `page` (int, optional) - Page number, default: 1
- `pageSize` (int, optional) - Records per page, default: 50, max: 100
- `actionType` (string, optional) - Filter by action type: "Created", "Updated", or "Deleted"
- `startDate` (DateTime, optional) - Filter records after this date
- `endDate` (DateTime, optional) - Filter records before this date

**Example Request:**
```http
GET /api/companies/acme-123/audit-history/Person/1?page=1&pageSize=10&actionType=Updated
Authorization: Bearer {jwt_token}
```

**Example Response:**
```json
{
  "totalCount": 25,
  "pageNumber": 1,
  "pageSize": 10,
  "totalPages": 3,
  "actions": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "actionDate": "2026-02-17T10:30:00Z",
      "actionType": "Updated",
      "description": "Name changed",
      "metadata": null,
      "entityName": "Person",
      "entityId": "1",
      "userId": "user123",
      "userName": "John Admin",
      "fieldName": "Name",
      "oldValue": "John Doe",
      "newValue": "Jonathan Doe"
    },
    {
      "id": "7ba85f64-5717-4562-b3fc-2c963f66bfa7",
      "actionDate": "2026-02-17T09:15:00Z",
      "actionType": "Updated",
      "description": "PhoneNumber changed",
      "metadata": null,
      "entityName": "Person",
      "entityId": "1",
      "userId": "user123",
      "userName": "John Admin",
      "fieldName": "PhoneNumber",
      "oldValue": "(555) 123-4567",
      "newValue": "(555) 987-6543"
    }
  ]
}
```

### 2. Get Audit Summary
**Endpoint:** `GET /summary`

**Description:** Retrieves aggregated audit statistics by entity type for a given time period.

**Path Parameters:**
- `companyId` (string) - Company identifier

**Query Parameters:**
- `entityName` (string, optional) - Filter by specific entity type
- `startDate` (DateTime, optional) - Summary start date, default: 30 days ago
- `endDate` (DateTime, optional) - Summary end date, default: now

**Example Request:**
```http
GET /api/companies/acme-123/audit-history/summary?startDate=2026-02-01
Authorization: Bearer {jwt_token}
```

**Example Response:**
```json
[
  {
    "entityName": "Person",
    "totalChanges": 145,
    "lastModified": "2026-02-17T10:30:00Z",
    "lastModifiedBy": "John Admin"
  },
  {
    "entityName": "Schedule",
    "totalChanges": 89,
    "lastModified": "2026-02-16T15:20:00Z",
    "lastModifiedBy": "Jane Manager"
  },
  {
    "entityName": "Location",
    "totalChanges": 12,
    "lastModified": "2026-02-15T08:45:00Z",
    "lastModifiedBy": "System"
  }
]
```

## Response Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 OK | Request successful, data returned |
| 400 Bad Request | Invalid parameters (missing companyId, entityName, or entityId) |
| 404 Not Found | No audit history found for the specified entity |
| 500 Internal Server Error | Server error occurred |

## Common Use Cases

### View All Changes to a Person
```http
GET /api/companies/acme-123/audit-history/Person/42
```

### View Recent Updates Only
```http
GET /api/companies/acme-123/audit-history/Person/42?actionType=Updated
```

### View Changes in Last Week
```http
GET /api/companies/acme-123/audit-history/Person/42?startDate=2026-02-10
```

### Get Activity Summary for All Entities
```http
GET /api/companies/acme-123/audit-history/summary
```

### Get Activity Summary for Schedules Only
```http
GET /api/companies/acme-123/audit-history/summary?entityName=Schedule
```

## Tracked Entities

The following entities are automatically tracked when they have a `CompanyId`:
- Person
- Location
- Schedule
- ScheduleShift
- TaskShift
- Area
- Role
- Crew
- ShiftEvent
- KioskQuestion
- KioskAnswer
- ReplacementRequest
- TimeOffRequest
- PTOLedger
- CompanySettings
- DeviceToken
- ShiftSummaryApproval
- And all other entities with CompanyId

## Field-Level Tracking

For each update operation, the system tracks:
- **Field Name** - Which field was changed
- **Old Value** - Previous value before the change
- **New Value** - New value after the change
- **User Context** - Who made the change (userId and userName)
- **Timestamp** - Exact date and time of the change

## Excluded Fields

For security and privacy, the following fields are **NOT** tracked in audit logs:
- Pin
- Password
- PasswordHash
- Token
- RefreshToken
- ApiKey
- Secret

## Performance Notes

- Default page size is 50 records to balance performance and usability
- Maximum page size is limited to 100 records per request
- Queries are optimized with composite indexes
- Multi-tenant isolation is enforced at the database level
- Typical query response time: < 500ms

## Authentication

All audit history endpoints require authentication via JWT Bearer token:
```http
Authorization: Bearer {your_jwt_token}
```

## Testing

Use the provided HTTP test file:
- `ShiftWork.Api/ShiftWork.Api.http`

Sample requests are included for all endpoints.
