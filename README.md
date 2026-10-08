# 💕 date_build_sim 🖥️

A PC build tutorial as a visual novel dating sim, with a live world-model video stream. 🎮✨

This is just a silly, quick hackathon project for Reactor x Google: World Models Hackathon 🌍🤖, inspired by Tax Heaven 3000. 🏝️

## 🚀 Quickstart

Needs Node.js 20+ and a Reactor API key 🔑 from
[reactor.inc/account/api-keys](https://www.reactor.inc/account/api-keys).
From the repo root:

```bash
corepack enable
pnpm install
cp .env.example .env
```

`corepack enable` (once per machine) makes the `pnpm` command available. 📦
Then open `.env` and replace the placeholder with your key
(`REACTOR_API_KEY=rk_...`), and start the app: 🔥

```bash
pnpm dev
```

Open http://localhost:3000 🌐 and enjoy! 🎉

**🖼️ Images aren't included.** Before the video will play, add the two guide
sprites at `public/characters/aoi.jpg` 👩 and `public/characters/haruto.jpg` 👨.
Step and part images are optional. See
[Images](docs/DOCUMENTATION.md#images-not-included) for the full list and the
prompts to generate them. 🎨

📚 For how everything works, see [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md).

## 📄 License

[MIT](LICENSE) 💖
