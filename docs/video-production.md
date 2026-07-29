# MiMo TTS/ASR video production

Vigil's submission video is rendered from deterministic scene data in
`demo/video-scenes.json`.

The pipeline:

1. renders seven 1920×1080 vector slides;
2. calls MiMo `mimo-v2.5-tts` with the Milo English voice;
3. transcribes every generated WAV with `mimo-v2.5-asr`;
4. rejects the build if minimum word similarity is below 72%;
5. normalizes narration to approximately -16 LUFS;
6. generates and burns synchronized SRT captions; and
7. encodes an H.264/AAC MP4 with FFmpeg.

## Security prerequisite

If an API key has ever been pasted into chat, revoke it before use. Create a new
MiMo key and store it only in the gitignored `.env`:

```dotenv
MIMO_API_KEY=your_new_key_here
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
```

The renderer never prints the key, request headers, or `.env` contents.

## Commands

Synchronize non-secret local defaults without printing existing values:

```powershell
npm run env:sync
```

Render slides without any API call:

```powershell
npm run video:assets
```

Smoke-test FFmpeg encoding, concatenation, and burned captions without any API
call:

```powershell
npm run video:smoke
```

Render and ASR-verify the complete video:

```powershell
npm run video:render
```

Outputs:

- `demo/output/vigil-keeperhub-demo.mp4`
- `demo/output/vigil-keeperhub-demo.srt`
- `artifacts/video/asr-validation.json`

The build directory and final video are gitignored because they contain large,
reproducible media. A reviewed release copy is committed at
`demo/vigil-keeperhub-demo.mp4` with its sidecar captions and SHA-256. The
compact ASR validation artifact is committed as proof of the narration quality
check.
