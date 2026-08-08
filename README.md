# KidTube

A parent-curated YouTube-style React app for kids.

Parents approve videos in the settings screen. Approved videos appear on the
home feed in a YouTube-like grid, and each watch page recommends only other
approved videos.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Storage

The approved library is stored in browser `localStorage` under
`kidtube-library-v1`. This keeps the first version simple and private to the
device. Use a backend database later if approvals need to sync across devices.

## Features

- Curated home feed with approved videos only
- Watch view with embedded YouTube player
- Recommendations limited to approved videos
- Parent settings with searchable curated catalog
- Plus-button import for pasted YouTube links or video IDs
- Responsive layouts for desktop and mobile

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the production build
- `npm run lint`: run lint checks
- `npm test`: build and verify rendered app output
