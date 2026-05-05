using System.Text.Json;
using Windows.Media.Control;

static bool ContainsAny(string haystack, params string[] needles)
{
    foreach (var needle in needles)
    {
        if (haystack.Contains(needle, StringComparison.OrdinalIgnoreCase)) return true;
    }
    return false;
}

static bool IsBrowser(string? source)
{
    var value = source ?? "";
    return ContainsAny(value, "chrome", "firefox", "msedge", "edge");
}

static bool IsAllowedBrowserMedia(GlobalSystemMediaTransportControlsSessionMediaProperties props, string? source)
{
    if (!IsBrowser(source)) return true;

    var haystack = $"{props.Title} {props.Artist} {props.AlbumTitle} {source}";
    if (ContainsAny(haystack, "twitch", "twitch.tv", "twitter", "x.com")) return false;
    if (ContainsAny(haystack, "youtube", "youtu.be", "youtube music")) return true;

    return !string.IsNullOrWhiteSpace(props.Title) && !string.IsNullOrWhiteSpace(props.Artist);
}

static string SourceLabel(string? source)
{
    var value = (source ?? "").ToLowerInvariant();
    if (value.Contains("spotify")) return "Spotify";
    if (value.Contains("chrome")) return "Chrome";
    if (value.Contains("firefox")) return "Firefox";
    if (value.Contains("msedge")) return "Edge";
    if (value.Contains("vlc")) return "VLC";
    return source ?? "Windows";
}

var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
GlobalSystemMediaTransportControlsSession? session = null;
foreach (var candidate in manager.GetSessions())
{
    var candidateProps = await candidate.TryGetMediaPropertiesAsync();
    if (IsAllowedBrowserMedia(candidateProps, candidate.SourceAppUserModelId) &&
        candidate.GetPlaybackInfo().PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
    {
        session = candidate;
        break;
    }
}
if (session is null)
{
    foreach (var candidate in manager.GetSessions())
    {
        var candidateProps = await candidate.TryGetMediaPropertiesAsync();
        if (IsAllowedBrowserMedia(candidateProps, candidate.SourceAppUserModelId))
        {
            session = candidate;
            break;
        }
    }
}

if (session is null)
{
    Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = "no_session" }));
    return;
}

var props = await session.TryGetMediaPropertiesAsync();
var info = session.GetPlaybackInfo();
if (!IsAllowedBrowserMedia(props, session.SourceAppUserModelId))
{
    Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = "browser_media_filtered" }));
    return;
}

string? image = null;

if (props.Thumbnail is not null)
{
    using var stream = await props.Thumbnail.OpenReadAsync();
    using var netStream = stream.AsStreamForRead();
    using var memory = new MemoryStream();
    await netStream.CopyToAsync(memory);
    image = $"data:{stream.ContentType};base64,{Convert.ToBase64String(memory.ToArray())}";
}

Console.WriteLine(JsonSerializer.Serialize(new
{
    ok = true,
    title = props.Title,
    artist = props.Artist,
    album = props.AlbumTitle,
    status = info.PlaybackStatus.ToString(),
    source = session.SourceAppUserModelId,
    sourceLabel = SourceLabel(session.SourceAppUserModelId),
    image
}));
