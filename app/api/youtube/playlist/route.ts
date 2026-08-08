function isYouTubeHost(hostname: string) {
  return (
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname.endsWith(".youtube.com")
  );
}

function extractPlaylistId(url: URL) {
  return url.searchParams.get("list");
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url")?.trim();

  if (!rawUrl) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const playlistUrl = new URL(rawUrl);
    if (!isYouTubeHost(playlistUrl.hostname)) {
      return Response.json({ error: "Only YouTube playlists are supported" }, { status: 400 });
    }

    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
      return Response.json({ error: "Playlist ID is required" }, { status: 400 });
    }

    const fetchUrl = new URL("https://www.youtube.com/playlist");
    fetchUrl.searchParams.set("list", playlistId);

    const response = await fetch(fetchUrl, {
      headers: {
        accept: "text/html",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (compatible; KidTube parent playlist import)",
      },
    });

    if (!response.ok) {
      return Response.json({ error: "Playlist unavailable" }, { status: 404 });
    }

    const html = await response.text();
    const videoIds = Array.from(
      new Set(
        Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g))
          .map((match) => match[1])
          .filter(Boolean),
      ),
    ).slice(0, 100);

    if (videoIds.length === 0) {
      return Response.json({ error: "No videos found in playlist" }, { status: 404 });
    }

    return Response.json({ playlistId, videoIds });
  } catch {
    return Response.json({ error: "Invalid YouTube playlist link" }, { status: 400 });
  }
}
