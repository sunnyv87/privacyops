# @privacyops/consent-sdk

Browser SDK for the TechD PrivacyOps consent stack. Provides:

- `ConsentClient` — fetch-based wrapper around `/api/v1/consent/*`
- `ConsentBanner` — framework-less DPDP/GDPR/CCPA consent banner with shadow-DOM styling

The SDK calls the **existing** PrivacyOps consent APIs. No backend changes required.

## Install

This package is workspace-private. Import via path:

```ts
import { ConsentBanner } from '@privacyops/consent-sdk';
```

## Usage

```ts
const banner = new ConsentBanner({
  apiBaseUrl: 'https://api.example.com',
  tenantId: '00000000-0000-0000-0000-000000000000',
  noticeId: 'notice_web_default',
  onSubmit: (record) => console.log('consent saved', record),
  onError: (err) => console.error(err),
});

await banner.mount();
```

## Client-only usage

```ts
import { ConsentClient } from '@privacyops/consent-sdk';

const client = new ConsentClient({
  apiBaseUrl: 'https://api.example.com',
  tenantId: '00000000-0000-0000-0000-000000000000',
  noticeId: 'notice_web_default',
});

const notice = await client.getNotice();
await client.grant({ noticeId: notice.id, purposeCodes: ['analytics', 'marketing'] });
```
