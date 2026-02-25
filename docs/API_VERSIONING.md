# NEPA API Versioning Strategy

This document describes the API versioning approach for the NEPA platform, providing backward compatibility, clear lifecycle, and smooth migration paths for API consumers.

## Overview

- **Supported versions**: `v1`, `v2`
- **Default version**: `v2` (when no version is specified)
- **Versioning methods**: URL path, `X-API-Version` header, `Accept` header, or query parameter

## How to Request a Version

### 1. URL path (recommended)

Use the version in the path for stable, explicit versioning:

- **v1**: `https://api.nepa.example.com/api/v1/auth/login`
- **v2**: `https://api.nepa.example.com/api/v2/auth/login`
- **Default (v2)**: `https://api.nepa.example.com/api/auth/login`

### 2. Header: X-API-Version

Send the version in a header:

```http
GET /api/auth/login
X-API-Version: v1
```

### 3. Accept header (content negotiation)

```http
GET /api/auth/login
Accept: application/vnd.nepa.v1+json
```

### 4. Query parameter

```http
GET /api/auth/login?version=v1
```

## Version Discovery

- **GET /api/versions** (no authentication): Returns supported versions, default version, latest version, and lifecycle (released/sunset/deprecation) for each version.

Example response:

```json
{
  "defaultVersion": "v2",
  "latestVersion": "v2",
  "supportedVersions": ["v1", "v2"],
  "lifecycle": {
    "v1": { "version": "v1", "status": "stable", "releasedAt": "..." },
    "v2": { "version": "v2", "status": "stable", "releasedAt": "..." }
  }
}
```

## Lifecycle and Deprecation

Each version has a **status**:

| Status      | Description |
|------------|-------------|
| `stable`   | Actively supported; no breaking changes without a new version. |
| `deprecated` | Still supported but will be sunset; clients should migrate. Response headers include `Deprecation: true` and optional `Sunset` (RFC 8594) and `Link` to migration guide. |
| `sunset`   | Version is no longer supported; requests may return 410 Gone or 406. |

Deprecation and sunset dates are defined in `config/api-versioning.ts`. When a version is deprecated or sunset, the API may send:

- **Deprecation**: `true`
- **Sunset**: RFC 3339 date after which the version is removed
- **Link**: URL to migration documentation

## Backward Compatibility

- New **minor** features and non-breaking changes can be added to an existing version.
- **Breaking** changes require a new version (e.g. v3). The previous version continues to work until its deprecation/sunset date.
- Default and latest version are updated only when we want new clients to use the new version by default.

## Migration Path

1. Prefer **path-based versioning** (`/api/v1`, `/api/v2`) in your integration.
2. Call **GET /api/versions** to see supported versions and lifecycle.
3. When a version is marked **deprecated**, plan migration using the `migrationGuideUrl` (or `Link` header) and the **Sunset** date.
4. Use **version-specific docs**: `/api-docs/v1`, `/api-docs/v2` for OpenAPI docs per version.

## Version-Specific Documentation

- **Default**: `/api-docs` — documents all versions (default server is v2).
- **v1**: `/api-docs/v1` — OpenAPI for v1 only.
- **v2**: `/api-docs/v2` — OpenAPI for v2 only.

## Analytics and Version Usage

The API records which version is used per request (path, header, or default) for analytics and adoption tracking. This supports deprecation planning and version sunset policies.

## Configuration

Version lifecycle and supported versions are configured in:

- **Config**: `config/api-versioning.ts`
- **Middleware**: `middleware/apiVersion.ts`

To add a new version (e.g. v3):

1. Add it to `supportedVersions` and `lifecycle` in `config/api-versioning.ts`.
2. Create a v3 router (e.g. in `routes/apiVersions.ts`) and mount it at `/api/v3`.
3. Update `defaultVersion` and `latestVersion` when v3 becomes the default.
4. Add versioned Swagger at `/api-docs/v3` if needed.
