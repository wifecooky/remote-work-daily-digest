# Remote Work Daily Digest

Automated, trilingual daily digest for remote workers and digital nomads.

Collects articles from 9 sources — Remote OK, We Work Remotely, remote work blogs, and Hacker News — then uses AI to score, filter, and translate into English, Chinese, and Japanese.

Built with [digest-factory](https://github.com/wifecooky/digest-factory).

## Sources

| Category | Sources |
|----------|---------|
| Job Boards | Remote OK, We Work Remotely |
| Blogs | Remote.com Blog, Buffer Blog, Hubstaff Blog |
| News | Google News Remote Work (en/zh/ja), Hacker News |

## Quick Start

```bash
npm install
cd frontend && npm install && cd ..
export OPENAI_API_KEY=sk-...
npm run generate-daily
cd frontend && npm run build && npm run preview
```

## Pipeline

| Command | Description |
|---------|-------------|
| `npm run collect` | Fetch articles from all sources |
| `npm run filter` | AI editorial selection (remote work-focused) |
| `npm run translate` | Translate to en/zh/ja |
| `npm run generate-daily` | Full pipeline |
| `npm run newsletter` | Send via Buttondown |

## Contact

[@wifecooky](https://x.com/wifecooky)
