function isYouTubeHost(hostname: string) {
  return (
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "youtu.be" ||
    hostname.endsWith(".youtube.com")
  );
}

function extractYouTubeId(url: URL) {
  if (url.hostname.includes("youtu.be")) {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (url.searchParams.get("v")) {
    return url.searchParams.get("v");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const marker = parts.findIndex((part) =>
    ["embed", "shorts", "live"].includes(part),
  );
  return marker >= 0 ? parts[marker + 1] ?? null : null;
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function extractBalancedJson(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const start = source.indexOf("{", markerIndex);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

async function fetchVideoDurationSeconds(videoId: string) {
  try {
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const embedResponse = await fetch(embedUrl, {
      headers: {
        accept: "text/html",
        "accept-language": "en-US,en;q=0.9",
        referer: "https://www.youtube.com/",
        "user-agent":
          "Mozilla/5.0 (compatible; KidTube parent import metadata)",
      },
    });

    if (embedResponse.ok) {
      const embedHtml = await embedResponse.text();
      const apiKey = embedHtml.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
      const clientVersion = embedHtml.match(
        /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/,
      )?.[1];

      if (apiKey && clientVersion) {
        const playerResponse = await fetch(
          `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "https://www.youtube.com",
              referer: embedUrl,
              "user-agent":
                "Mozilla/5.0 (compatible; KidTube parent import metadata)",
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: "WEB",
                  clientVersion,
                  gl: "US",
                  hl: "en",
                },
              },
              videoId,
            }),
          },
        );

        if (playerResponse.ok) {
          const player = (await playerResponse.json()) as {
            videoDetails?: { lengthSeconds?: string };
          };
          const playerSeconds = Number(player.videoDetails?.lengthSeconds);
          if (Number.isFinite(playerSeconds) && playerSeconds > 0) {
            return playerSeconds;
          }
        }
      }
    }

    const watchUrl = new URL("https://www.youtube.com/watch");
    watchUrl.searchParams.set("v", videoId);
    const response = await fetch(watchUrl, {
      headers: {
        accept: "text/html",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (compatible; KidTube parent import metadata)",
      },
    });

    if (!response.ok) {
      return 0;
    }

    const html = await response.text();
    const playerJson =
      extractBalancedJson(html, "ytInitialPlayerResponse") ??
      extractBalancedJson(html, "window[\"ytInitialPlayerResponse\"]");
    const player = playerJson
      ? (JSON.parse(playerJson) as {
          videoDetails?: { lengthSeconds?: string };
        })
      : null;
    const parsedSeconds = Number(player?.videoDetails?.lengthSeconds);

    if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
      return parsedSeconds;
    }

    const fallbackMatch = html.match(/"lengthSeconds":"(\d+)"/);
    const fallbackSeconds = Number(fallbackMatch?.[1]);
    return Number.isFinite(fallbackSeconds) && fallbackSeconds > 0
      ? fallbackSeconds
      : 0;
  } catch {
    return 0;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url")?.trim();

  if (!rawUrl) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const videoUrl = new URL(rawUrl);
    if (!isYouTubeHost(videoUrl.hostname)) {
      return Response.json({ error: "Only YouTube links are supported" }, { status: 400 });
    }

    const videoId = extractYouTubeId(videoUrl);

    const oembedUrl = new URL("https://www.youtube.com/oembed");
    oembedUrl.searchParams.set("url", videoUrl.toString());
    oembedUrl.searchParams.set("format", "json");

    const response = await fetch(oembedUrl, {
      headers: {
        accept: "application/json",
        "user-agent": "KidTube parent import",
      },
    });

    if (!response.ok) {
      return Response.json({ error: "Video details unavailable" }, { status: 404 });
    }

    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    const durationSeconds = videoId ? await fetchVideoDurationSeconds(videoId) : 0;

    return Response.json({
      title: data.title ?? "",
      channel: data.author_name ?? "",
      duration: durationSeconds > 0 ? formatDuration(durationSeconds) : "",
      durationSeconds,
      thumbnailUrl: data.thumbnail_url ?? "",
    });
  } catch {
    return Response.json({ error: "Invalid YouTube link" }, { status: 400 });
  }
}
