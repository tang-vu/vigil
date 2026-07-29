import "dotenv/config";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import scenesJson from "../demo/video-scenes.json" with { type: "json" };

interface Scene {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly bullets: readonly string[];
  readonly metricLabel: string;
  readonly metricValue: string;
  readonly accent: string;
  readonly narration: string;
}

interface AudioResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly audio?: {
        readonly data?: string;
      };
    };
  }[];
}

interface AsrResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string;
    };
  }[];
}

interface AsrResult {
  readonly sceneId: string;
  readonly expected: string;
  readonly transcript: string;
  readonly wordSimilarity: number;
}

const scenes = scenesJson as readonly Scene[];
const root = path.resolve(".");
const buildDirectory = path.join(root, "demo", "build");
const outputDirectory = path.join(root, "demo", "output");
const artifactDirectory = path.join(root, "artifacts", "video");
const finalVideo = path.join(outputDirectory, "vigil-keeperhub-demo.mp4");
const finalCaptions = path.join(outputDirectory, "vigil-keeperhub-demo.srt");
const baseUrl = (
  process.env["MIMO_BASE_URL"] ?? "https://api.xiaomimimo.com/v1"
).replace(/\/+$/, "");

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapWords(text: string, maximumCharacters: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/u)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maximumCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function textLines(
  lines: readonly string[],
  x: number,
  y: number,
  lineHeight: number,
  className: string,
): string {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" class="${className}">${xml(line)}</text>`,
    )
    .join("\n");
}

function slideSvg(scene: Scene, index: number): string {
  const titleLines = wrapWords(scene.title, 31);
  const bulletStart = 586 + Math.max(0, titleLines.length - 1) * 100;
  const bulletMarkup = scene.bullets
    .map((bullet, bulletIndex) => {
      const y = bulletStart + bulletIndex * 84;
      return `
        <circle cx="126" cy="${y - 8}" r="7" fill="${scene.accent}"/>
        <text x="154" y="${y}" class="bullet">${xml(bullet)}</text>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#090B16"/>
      <stop offset="0.55" stop-color="#101429"/>
      <stop offset="1" stop-color="#080A12"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="${scene.accent}" stop-opacity="0.30"/>
      <stop offset="1" stop-color="${scene.accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="20" stdDeviation="26" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
    <style>
      text { font-family: 'Segoe UI', Arial, sans-serif; }
      .eyebrow { font-size: 24px; font-weight: 700; letter-spacing: 5px; fill: ${scene.accent}; }
      .title { font-size: 78px; font-weight: 700; letter-spacing: -2px; fill: #F6F7FF; }
      .subtitle { font-size: 31px; font-weight: 400; fill: #A9B0CA; }
      .bullet { font-size: 28px; font-weight: 500; fill: #E4E7F5; }
      .metric-label { font-size: 20px; font-weight: 700; letter-spacing: 4px; fill: #8992B2; }
      .metric-value { font-size: 37px; font-weight: 700; fill: #FFFFFF; }
      .footer { font-size: 20px; font-weight: 600; fill: #7C84A2; letter-spacing: 1px; }
      .scene { font-size: 19px; font-weight: 700; fill: #AEB5CF; }
    </style>
  </defs>
  <rect width="1920" height="1080" fill="url(#background)"/>
  <circle cx="1660" cy="190" r="500" fill="url(#glow)"/>
  <circle cx="1770" cy="1000" r="420" fill="url(#glow)" opacity="0.35"/>
  <path d="M0 930 C480 860, 980 1100, 1920 870 L1920 1080 L0 1080 Z" fill="${scene.accent}" opacity="0.035"/>
  <g opacity="0.10" stroke="${scene.accent}" fill="none">
    <path d="M1180 80 H1830 V730" stroke-width="2"/>
    <path d="M1240 140 H1770 V670" stroke-width="1"/>
    <circle cx="1770" cy="140" r="9" fill="${scene.accent}"/>
    <circle cx="1240" cy="670" r="6" fill="${scene.accent}"/>
  </g>

  <g transform="translate(90 78)">
    <path d="M36 2 L67 15 V42 C67 67 53 84 36 94 C19 84 5 67 5 42 V15 Z"
      fill="${scene.accent}" opacity="0.18" stroke="${scene.accent}" stroke-width="3"/>
    <path d="M20 47 Q36 29 52 47 Q36 65 20 47 Z" fill="none" stroke="#FFFFFF" stroke-width="3"/>
    <circle cx="36" cy="47" r="6" fill="${scene.accent}"/>
  </g>
  <text x="184" y="132" class="footer" fill="#EDEEFF">VIGIL</text>
  <text x="1778" y="116" class="scene">${String(index + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}</text>

  <text x="100" y="272" class="eyebrow">${xml(scene.eyebrow)}</text>
  ${textLines(titleLines, 100, 382, 88, "title")}
  <text x="104" y="${408 + titleLines.length * 88}" class="subtitle">${xml(scene.subtitle)}</text>

  <g>
    ${bulletMarkup}
  </g>

  <g transform="translate(1170 410)" filter="url(#shadow)">
    <rect width="620" height="340" rx="34" fill="#151A31" stroke="${scene.accent}" stroke-opacity="0.45" stroke-width="2"/>
    <rect x="1" y="1" width="618" height="338" rx="33" fill="none" stroke="#FFFFFF" stroke-opacity="0.05"/>
    <circle cx="82" cy="86" r="34" fill="${scene.accent}" opacity="0.16"/>
    <path d="M62 87 L77 102 L105 69" fill="none" stroke="${scene.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="58" y="170" class="metric-label">${xml(scene.metricLabel)}</text>
    ${textLines(wrapWords(scene.metricValue, 26), 58, 230, 48, "metric-value")}
  </g>

  <g transform="translate(100 958)">
    <rect width="1720" height="1" fill="#FFFFFF" opacity="0.10"/>
    <text x="0" y="62" class="footer">KEEPERHUB · AAVE V3 · x402 · SIGNED EXECUTION RECEIPTS</text>
    <text x="1514" y="62" class="footer">github.com/tang-vu/vigil</text>
  </g>
</svg>`;
}

async function run(
  command: string,
  arguments_: readonly string[],
  options: { readonly quiet?: boolean } = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...arguments_], {
      cwd: root,
      stdio: options.quiet ? ["ignore", "ignore", "pipe"] : "inherit",
      windowsHide: true,
    });
    let standardError = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      standardError += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} exited with ${code}${standardError ? `: ${standardError.slice(-1_000)}` : ""}`,
          ),
        );
      }
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function buildSlides(): Promise<void> {
  await mkdir(buildDirectory, { recursive: true });
  for (const [index, scene] of scenes.entries()) {
    const svgPath = path.join(buildDirectory, `${scene.id}.svg`);
    const pngPath = path.join(buildDirectory, `${scene.id}.png`);
    await writeFile(svgPath, slideSvg(scene, index), "utf8");
    await run(
      "magick",
      [
        "-background",
        "none",
        "-density",
        "144",
        svgPath,
        "-resize",
        "1920x1080!",
        pngPath,
      ],
      { quiet: true },
    );
    console.info(`Slide ready: ${path.relative(root, pngPath)}`);
  }
}

function requireApiKey(): string {
  const key = process.env["MIMO_API_KEY"]?.trim();
  if (!key || !/^(sk|tp)-[A-Za-z0-9_-]+$/u.test(key)) {
    throw new Error(
      "Set a fresh MIMO_API_KEY in gitignored .env. Never paste the key into chat or source files.",
    );
  }
  return key;
}

async function mimoRequest<T>(
  apiKey: string,
  payload: Readonly<Record<string, unknown>>,
): Promise<T> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `MiMo API returned HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  }
  return (await response.json()) as T;
}

async function synthesizeScene(
  apiKey: string,
  scene: Scene,
): Promise<string> {
  const audioPath = path.join(buildDirectory, `${scene.id}.wav`);
  const cachePath = path.join(buildDirectory, `${scene.id}.tts.sha256`);
  const style =
    "Warm, confident English technical-demo narration. Crisp diction, energetic but credible, medium-fast pace. Pronounce Aave as ah-vay and KeeperHub as Keeper Hub.";
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify({
        model: "mimo-v2.5-tts",
        voice: "Milo",
        style,
        narration: scene.narration,
      }),
    )
    .digest("hex");
  const cachedKey = (await fileExists(cachePath))
    ? (await readFile(cachePath, "utf8")).trim()
    : undefined;
  if ((await fileExists(audioPath)) && cachedKey === cacheKey) {
    console.info(`TTS cached: ${path.relative(root, audioPath)}`);
    return audioPath;
  }
  const result = await mimoRequest<AudioResponse>(apiKey, {
    model: "mimo-v2.5-tts",
    messages: [
      {
        role: "user",
        content: style,
      },
      { role: "assistant", content: scene.narration },
    ],
    audio: { format: "wav", voice: "Milo" },
    temperature: 0.6,
    stream: false,
  });
  const encodedAudio = result.choices?.[0]?.message?.audio?.data;
  if (!encodedAudio) {
    throw new Error(`MiMo TTS returned no audio for ${scene.id}`);
  }
  await writeFile(audioPath, Buffer.from(encodedAudio, "base64"));
  await writeFile(cachePath, `${cacheKey}\n`, "utf8");
  console.info(`TTS generated: ${path.relative(root, audioPath)}`);
  return audioPath;
}

function normalizedWords(value: string): readonly string[] {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);
}

function wordSimilarity(expected: string, actual: string): number {
  const expectedWords = normalizedWords(expected);
  const actualCounts = new Map<string, number>();
  for (const word of normalizedWords(actual)) {
    actualCounts.set(word, (actualCounts.get(word) ?? 0) + 1);
  }
  let matches = 0;
  for (const word of expectedWords) {
    const remaining = actualCounts.get(word) ?? 0;
    if (remaining > 0) {
      matches += 1;
      actualCounts.set(word, remaining - 1);
    }
  }
  return expectedWords.length === 0 ? 1 : matches / expectedWords.length;
}

async function transcribeScene(
  apiKey: string,
  scene: Scene,
  audioPath: string,
): Promise<AsrResult> {
  const audioBytes = await readFile(audioPath);
  const audioSha256 = createHash("sha256").update(audioBytes).digest("hex");
  const cachePath = path.join(buildDirectory, `${scene.id}.asr.json`);
  if (await fileExists(cachePath)) {
    const cached = JSON.parse(await readFile(cachePath, "utf8")) as {
      readonly audioSha256?: unknown;
      readonly result?: AsrResult;
    };
    if (
      cached.audioSha256 === audioSha256 &&
      cached.result?.sceneId === scene.id &&
      typeof cached.result.transcript === "string" &&
      typeof cached.result.wordSimilarity === "number"
    ) {
      console.info(
        `ASR cached ${scene.id}: ${(cached.result.wordSimilarity * 100).toFixed(1)}% word similarity`,
      );
      return cached.result;
    }
  }
  const encodedAudio = audioBytes.toString("base64");
  const result = await mimoRequest<AsrResponse>(apiKey, {
    model: "mimo-v2.5-asr",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: `data:audio/wav;base64,${encodedAudio}`,
            },
          },
        ],
      },
    ],
    asr_options: { language: "en" },
    stream: false,
  });
  const transcript = result.choices?.[0]?.message?.content?.trim();
  if (!transcript) {
    throw new Error(`MiMo ASR returned no transcript for ${scene.id}`);
  }
  const similarity = wordSimilarity(scene.narration, transcript);
  console.info(
    `ASR verified ${scene.id}: ${(similarity * 100).toFixed(1)}% word similarity`,
  );
  const asrResult = {
    sceneId: scene.id,
    expected: scene.narration,
    transcript,
    wordSimilarity: Number(similarity.toFixed(4)),
  };
  await writeFile(
    cachePath,
    `${JSON.stringify({ audioSha256, result: asrResult }, null, 2)}\n`,
    "utf8",
  );
  return asrResult;
}

async function probeDuration(filePath: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { cwd: root, windowsHide: true },
    );
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      error += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      const duration = Number.parseFloat(output.trim());
      if (code !== 0 || !Number.isFinite(duration)) {
        reject(new Error(`ffprobe failed for ${filePath}: ${error}`));
      } else {
        resolve(duration);
      }
    });
  });
}

function srtTimestamp(seconds: number): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1_000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remainingSeconds = Math.floor((milliseconds % 60_000) / 1_000);
  const remainingMilliseconds = milliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")},${String(remainingMilliseconds).padStart(3, "0")}`;
}

function captionChunks(text: string, maximumWords = 13): readonly string[] {
  const words = text.split(/\s+/u);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += maximumWords) {
    chunks.push(words.slice(index, index + maximumWords).join(" "));
  }
  return chunks;
}

async function renderVideo(
  audioPaths: readonly string[],
  videoPath = finalVideo,
  captionsPath = finalCaptions,
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const segmentPaths: string[] = [];
  const captions: string[] = [];
  let timeline = 0;
  let cueIndex = 1;

  for (const [index, scene] of scenes.entries()) {
    const audioPath = audioPaths[index];
    if (!audioPath) {
      throw new Error(`Missing audio for ${scene.id}`);
    }
    const duration = await probeDuration(audioPath);
    const slidePath = path.join(buildDirectory, `${scene.id}.png`);
    const segmentPath = path.join(buildDirectory, `${scene.id}.mp4`);
    await run("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-framerate",
      "30",
      "-i",
      slidePath,
      "-i",
      audioPath,
      "-vf",
      "scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=0.35,fade=t=out:st=" +
        Math.max(0, duration - 0.35).toFixed(3) +
        ":d=0.35",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.15,afade=t=out:st=" +
        Math.max(0, duration - 0.25).toFixed(3) +
        ":d=0.25",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-t",
      duration.toFixed(3),
      "-movflags",
      "+faststart",
      segmentPath,
    ], { quiet: true });
    segmentPaths.push(segmentPath);

    const chunks = captionChunks(scene.narration);
    const chunkDuration = duration / chunks.length;
    for (const [chunkIndex, chunk] of chunks.entries()) {
      const start = timeline + chunkIndex * chunkDuration;
      const end = timeline + (chunkIndex + 1) * chunkDuration;
      captions.push(
        `${cueIndex}\n${srtTimestamp(start)} --> ${srtTimestamp(end)}\n${chunk}\n`,
      );
      cueIndex += 1;
    }
    timeline += duration;
  }

  await writeFile(captionsPath, `${captions.join("\n")}\n`, "utf8");
  const concatPath = path.join(buildDirectory, "segments.txt");
  await writeFile(
    concatPath,
    segmentPaths
      .map((segmentPath) => `file '${segmentPath.replaceAll("\\", "/")}'`)
      .join("\n"),
    "utf8",
  );
  const joinedVideo = path.join(buildDirectory, "joined.mp4");
  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-c",
    "copy",
    joinedVideo,
  ], { quiet: true });
  await run("ffmpeg", [
    "-y",
    "-i",
    joinedVideo,
    "-vf",
    `subtitles=${path.relative(root, captionsPath).replaceAll("\\", "/")}:force_style='FontName=Segoe UI,FontSize=10,PrimaryColour=&H00FFFFFF,BackColour=&H80090B16,OutlineColour=&HCC090B16,BorderStyle=3,Outline=1,Shadow=0,MarginV=28,Alignment=2'`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    videoPath,
  ], { quiet: true });
  console.info(
    `Video rendered: ${path.relative(root, videoPath)} (${timeline.toFixed(1)} seconds)`,
  );
}

async function main(): Promise<void> {
  await mkdir(buildDirectory, { recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(artifactDirectory, { recursive: true });
  await buildSlides();

  if (process.argv.includes("--assets-only")) {
    console.info("Assets-only mode complete; no MiMo API call was made.");
    return;
  }
  if (process.argv.includes("--smoke-test")) {
    const smokeAudioPaths: string[] = [];
    for (const scene of scenes) {
      const smokeAudioPath = path.join(
        buildDirectory,
        `${scene.id}-smoke.wav`,
      );
      await run(
        "ffmpeg",
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:sample_rate=24000,volume=0.01",
          "-t",
          "1.25",
          "-c:a",
          "pcm_s16le",
          smokeAudioPath,
        ],
        { quiet: true },
      );
      smokeAudioPaths.push(smokeAudioPath);
    }
    await renderVideo(
      smokeAudioPaths,
      path.join(outputDirectory, "vigil-keeperhub-demo-smoke.mp4"),
      path.join(outputDirectory, "vigil-keeperhub-demo-smoke.srt"),
    );
    console.info("Media smoke test complete; no MiMo API call was made.");
    return;
  }

  const apiKey = requireApiKey();
  const audioPaths: string[] = [];
  const asrResults: AsrResult[] = [];
  for (const scene of scenes) {
    const audioPath = await synthesizeScene(apiKey, scene);
    audioPaths.push(audioPath);
    asrResults.push(await transcribeScene(apiKey, scene, audioPath));
  }
  const minimumSimilarity = Math.min(
    ...asrResults.map((result) => result.wordSimilarity),
  );
  const validation = {
    generatedAt: new Date().toISOString(),
    ttsModel: "mimo-v2.5-tts",
    ttsVoice: "Milo",
    asrModel: "mimo-v2.5-asr",
    minimumWordSimilarity: minimumSimilarity,
    passed: minimumSimilarity >= 0.72,
    scenes: asrResults,
  };
  await writeFile(
    path.join(artifactDirectory, "asr-validation.json"),
    `${JSON.stringify(validation, null, 2)}\n`,
    "utf8",
  );
  if (!validation.passed) {
    throw new Error(
      `MiMo ASR validation failed: minimum similarity ${(minimumSimilarity * 100).toFixed(1)}%`,
    );
  }
  await renderVideo(audioPaths);
}

await main();
