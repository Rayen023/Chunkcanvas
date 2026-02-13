This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## FAISS Backend (FastAPI + uv)

ChunkCanvas now includes a local Python backend for FAISS management in `backend/`.

```bash
cd backend && source .venv/bin/activate && uvicorn app.faiss_server:app --reload --port 8010
```

Then use the **FAISS** option in Step 6 of the app and point it to `http://localhost:8010`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Ollama
/mnt/0a56cc8f-eb63-4f04-b727-0615646b8bdb/ollama_models

curl http://localhost:11434/api/tags

sudo chown -R ollama:ollama /mnt/0a56cc8f-eb63-4f04-b727-0615646b8bdb/ollama_models


https://ollama.com/search?c=vision