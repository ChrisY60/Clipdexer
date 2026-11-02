"use client";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Play,
  Check,
  ChevronDown,
  Layers,
  Settings2,
  Radio,
  Upload,
  Link as LinkIcon,
  X,
  LoaderCircle,
  Eye,
  AudioLines,
  Film,
  LogOut,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Clip, ClipPage, Match, stamp } from "@/lib/types";
type Config = {
  ai: boolean;
  twitch: boolean;
  readOnly?: boolean;
  examples?: string[];
  user: { id: string; name: string; role: string } | null;
};
type TwitchClip = {
  id: string;
  title: string;
  broadcaster_name: string;
  thumbnail_url: string;
  duration: number;
  video_id: string;
};
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please retry.");
  return data;
}
function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M5 4h14v6H11v12h8v6H5zM21 4h6v24h-6z" fill="currentColor" />
        <path d="m14 13 6 3-6 3z" fill="currentColor" />
      </svg>
    </span>
  );
}
function Art({ clip }: { clip: Clip }) {
  const [unavailable, setUnavailable] = useState(false);
  const preview = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!preview.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(preview.current);
    return () => observer.disconnect();
  }, [clip.id]);
  if (clip.source === "sample")
    return (
      <img
        src={`/samples/${clip.thumbnail}.svg`}
        loading="lazy"
        alt="Illustrated sample storyboard"
      />
    );
  if (clip.source !== "link" && !unavailable)
    return (
      <video
        className="clip-still"
        ref={preview}
        src={visible ? `/api/media/${clip.id}#t=0.1` : undefined}
        preload="metadata"
        muted
        playsInline
        aria-label={`Still from ${clip.title}`}
        onError={() => setUnavailable(true)}
      />
    );
  return (
    <div className="generic-art">
      <Film size={46} />
      <span>
        {clip.source === "twitch"
          ? "TWITCH CLIP"
          : clip.source === "link"
            ? "SAVED LINK"
            : "YOUR MOMENT"}
      </span>
    </div>
  );
}
export default function Home() {
  const [config, setConfig] = useState<Config>({
    ai: false,
    twitch: false,
    user: null,
  });
  const [mode, setMode] = useState<"demo" | "twitch">("demo");
  const [tab, setTab] = useState("Discover");
  const [clips, setClips] = useState<Clip[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ClipPage>({
    clips: [],
    page: 1,
    pages: 1,
    total: 0,
    counts: { total: 0, ready: 0, pending: 0 },
  });
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");
  const libraryRequest = useRef(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[] | null>(null);
  const [showOtherMatches, setShowOtherMatches] = useState(false);
  const [searched, setSearched] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"upload" | "settings" | "twitch" | null>(
    null,
  );
  const [selected, setSelected] = useState<{
    clip: Clip;
    time: number;
    evidence?: Match["evidence"];
  } | null>(null);
  const [filter, setFilter] = useState("All moments");
  const [intro, setIntro] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const pageNavigation = useRef(false);
  const searchVersion = useRef(0);
  const view = tab === "Processing" ? "processing" : "library";
  const libraryKey = `${mode}/${filter}/${page}/${view}`;
  const activeLibrary = useRef(libraryKey);
  activeLibrary.current = libraryKey;
  async function refresh(updateConfig = true) {
    const request = ++libraryRequest.current;
    const params = new URLSearchParams({
      mode,
      page: String(page),
      view,
      filter:
        filter === "Samples"
          ? "samples"
          : filter === "My uploads"
            ? "uploads"
            : "all",
    });
    try {
      const [c, data] = await Promise.all([
        updateConfig ? api("/api/config") : Promise.resolve(null),
        api(`/api/clips?${params}`) as Promise<ClipPage>,
      ]);
      if (
        request !== libraryRequest.current ||
        activeLibrary.current !== libraryKey
      )
        return;
      if (c) setConfig(c);
      setClips(data.clips);
      setPagination(data);
      setPage(data.page);
      setLibraryError("");
    } catch (e) {
      if (
        request === libraryRequest.current &&
        activeLibrary.current === libraryKey
      )
        setLibraryError((e as Error).message);
    } finally {
      if (
        request === libraryRequest.current &&
        activeLibrary.current === libraryKey
      )
        setLibraryLoading(false);
    }
  }
  useEffect(() => {
    setClips([]);
    setLibraryLoading(true);
    setLibraryError("");
    void refresh();
  }, [libraryKey]);
  useEffect(() => {
    if (libraryLoading || !pageNavigation.current) return;
    pageNavigation.current = false;
    resultsHeading.current?.focus({ preventScroll: true });
    resultsHeading.current?.scrollIntoView({ block: "start" });
  }, [libraryLoading]);
  useEffect(() => {
    if (!pagination.counts.pending) return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh(false);
    }, 4000);
    return () => clearInterval(timer);
  }, [libraryKey, pagination.counts.pending]);
  useEffect(() => {
    setDetailLoading(false);
    setDetailError("");
    if (!selected || selected.clip.segmentCount === undefined) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    api(`/api/clips?${new URLSearchParams({ mode, id: selected.clip.id })}`)
      .then((clip) => {
        if (!cancelled)
          setSelected((current) => (current ? { ...current, clip } : null));
      })
      .catch((e) => {
        if (!cancelled) setDetailError(e.message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.clip.id, detailRetry, mode]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "upload") setModal("upload");
    if (params.get("view") === "library") setTab("Clip library");
    if (params.get("error")) setError(params.get("error")!);
    if (params.has("connected")) setMode("twitch");
    if (
      params.has("action") ||
      params.has("view") ||
      params.has("connected") ||
      params.has("error")
    ) {
      window.history.replaceState(
        {},
        "",
        window.location.pathname + window.location.hash,
      );
    }
    const timer = setTimeout(() => setIntro(1), 1300);
    const foundTimer = setTimeout(() => setIntro(2), 2700);
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        setTab("Discover");
        requestAnimationFrame(() => input.current?.focus());
      }
      if (e.key === "Escape") {
        setModal(null);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      clearTimeout(foundTimer);
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    if (results === null) return;
    resultsHeading.current?.focus({ preventScroll: true });
    resultsHeading.current?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  }, [results]);
  function switchMode(next: "demo" | "twitch") {
    searchVersion.current++;
    setBusy(false);
    setMode(next);
    setPage(1);
    setSelected(null);
    setResults(null);
    setQuery("");
    setFilter("All moments");
  }
  async function search(text = query) {
    if (!text.trim()) return;
    const version = ++searchVersion.current;
    setQuery(text);
    setBusy(true);
    setError("");
    setShowOtherMatches(false);
    setTab("Discover");
    try {
      const data = await api("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, mode }),
      });
      if (version !== searchVersion.current) return;
      setResults(data.results);
      setNotice(data.notice);
      setSearched(text);
    } catch (e) {
      if (version === searchVersion.current) setError((e as Error).message);
    } finally {
      if (version === searchVersion.current) setBusy(false);
    }
  }
  async function retry(id: string) {
    try {
      await api("/api/clips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const display = clips;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Clipdexer home">
          <Mark />
          <span>clipdexer</span>
        </a>
        <div className="workspace-label">
          YOUR WORKSPACE <span>V.01</span>
        </div>
        <button className="workspace" onClick={() => setModal("settings")}>
          <span className="workspace-avatar">
            {mode === "demo" ? "D" : config.user?.name[0] || "T"}
          </span>
          <span>
            <strong>
              {mode === "demo"
                ? "The demo room"
                : config.user?.name || "Twitch collection"}
            </strong>
            <small>
              {mode === "demo"
                ? "A little taste of the magic"
                : "Your authorized clips"}
            </small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav aria-label="Main navigation">
          {[
            { name: "Discover", icon: Search },
            { name: "Clip library", icon: Layers },
            { name: "Processing", icon: AudioLines },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? "nav-item active" : "nav-item"}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => {
                setTab(name);
                setPage(1);
                setResults(null);
              }}
            >
              <Icon size={19} />
              {name}
              {name === "Clip library" && (
                <span className="count">{pagination.counts.total}</span>
              )}
              {name === "Processing" && pagination.counts.pending > 0 && (
                <span className="count">{pagination.counts.pending}</span>
              )}
            </button>
          ))}
          <a
            className="nav-item nav-link"
            href="/about"
            aria-label="About Clipdexer"
          >
            <Info size={19} /> About
          </a>
        </nav>
        <div className="sidebar-divider" />
        {!config.readOnly && (
          <>
            <div className="workspace-label">CONNECTED CHANNELS</div>
            <button className="channel" onClick={() => setModal("twitch")}>
              <span className="channel-icon">
                <Radio size={17} />
              </span>
              <span>{config.user?.name || "Connect your Twitch"}</span>
              <Plus size={15} />
            </button>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="little-note">
            <strong>
              Good moments.
              <br />
              Terrible memory.
            </strong>
            <p>That’s what we’re here for.</p>
            {!config.readOnly && (
              <button onClick={() => setModal("upload")}>
                Add your first clip <ArrowUpRight size={16} />
              </button>
            )}
          </div>
          <button className="nav-item" onClick={() => setModal("settings")}>
            <Settings2 size={18} />
            Settings & connections
          </button>
          <div className="profile">
            <span className="profile-avatar">
              {config.user?.name[0] || "Y"}
            </span>
            <div>
              <strong>{config.user?.name || "Your local workspace"}</strong>
              <small>Local edition</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="top-actions">
            <button className="mode-pill" onClick={() => setModal("settings")}>
              <span />
              {config.readOnly
                ? "Hosted demo · read-only"
                : mode === "demo"
                  ? "Demo mode"
                  : "Twitch connected"}
              <ChevronDown size={13} />
            </button>
            {!config.readOnly && (
              <button
                className="button small"
                onClick={() => setModal("upload")}
              >
                <Plus size={16} />
                Add clips
              </button>
            )}
          </div>
        </header>
        <div className="page-content">
          <p className="sr-only" role="status">
            {busy
              ? "Searching saved indexes."
              : results
                ? `${results.length} matches. ${results.some((r) => r.confidence === "strong") ? "Evidence is ready to review." : "No confident match; any partial results are labeled weak."}`
                : ""}
          </p>
          {error && (
            <div className="alert" role="alert">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "Discover" && (
            <>
              <section className={`hero intro-${intro}`} id="search-desk">
                <h1>
                  <span className="headline-top">Wait, find me</span>
                  <span className="headline-bottom">
                    that clip <em>where</em>
                    <span className="orange">…</span>
                  </span>
                </h1>
                <p>Describe what stayed with you. We’ll find the moment.</p>
                <div className="archive-art" aria-hidden="true">
                  <img src="/identity/memory-loop.svg" alt="" />
                </div>
                <form
                  className="search-form"
                  role="search"
                  aria-busy={busy}
                  onSubmit={(e) => {
                    e.preventDefault();
                    search();
                  }}
                >
                  <Search size={24} />
                  <input
                    ref={input}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    maxLength={500}
                    aria-label="Describe the clip you remember"
                    placeholder="Describe the clip you remember…"
                  />
                  <kbd>Ctrl / ⌘ K</kbd>
                  <button
                    className="search-submit"
                    disabled={busy || !query.trim()}
                    aria-label="Find clip"
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={21} />
                    ) : (
                      <>
                        <span>Find the moment</span>
                        <ArrowUpRight size={23} />
                      </>
                    )}
                  </button>
                </form>
                {!!config.examples?.length && mode === "demo" && (
                  <div className="try-row" aria-label="Example searches">
                    <span>Try</span>
                    {config.examples.map((example) => (
                      <button
                        key={example}
                        type="button"
                        disabled={busy}
                        onClick={() => search(example)}
                      >
                        {example}
                        <ArrowRight size={13} />
                      </button>
                    ))}
                  </div>
                )}
                <span className="sr-only" role="status">
                  {busy
                    ? "Searching your indexed clips…"
                    : results
                      ? `${results.length} matching clips found.`
                      : ""}
                </span>
              </section>
              <section className="demo-banner">
                <div>
                  <strong>
                    {config.readOnly
                      ? `A preloaded demo collection of ${pagination.counts.ready} real clips.`
                      : mode === "demo"
                        ? "Every collection starts with a moment."
                        : "A living archive of your channel."}
                  </strong>
                  <p>
                    {config.readOnly
                      ? "Each clip was transcribed and its frames described by AI. Search for a moment, or open any clip below to see its full timestamped index."
                      : mode === "demo"
                        ? "Upload your clips to make them searchable."
                        : "Import a small collection of clips you are authorized to download."}
                  </p>
                </div>
                {config.readOnly ? (
                  <a href="/about">
                    How it works
                    <ArrowUpRight size={17} />
                  </a>
                ) : (
                  <button
                    onClick={() =>
                      setModal(mode === "demo" ? "upload" : "twitch")
                    }
                  >
                    {mode === "demo" ? "Add to the archive" : "Import clips"}
                    <ArrowUpRight size={17} />
                  </button>
                )}
              </section>
            </>
          )}
          {libraryLoading && !results ? (
            <p className="library-feedback" role="status">
              Loading clips…
            </p>
          ) : libraryError && !results ? (
            <div className="library-feedback" role="alert">
              {libraryError}{" "}
              <button
                className="button subtle"
                onClick={() => {
                  setLibraryLoading(true);
                  void refresh();
                }}
              >
                Try again
              </button>
            </div>
          ) : tab === "Processing" ? (
            <section className="library" id="library">
              <div className="section-heading">
                <div>
                  <h2 ref={resultsHeading} tabIndex={-1}>
                    Behind the moments
                  </h2>
                  <p>
                    Your videos are processed once. Their indexes stay here.
                  </p>
                </div>
              </div>
              {clips.filter((c) => c.source !== "sample" && c.status !== "link")
                .length === 0 ? (
                <div className="empty">
                  <AudioLines size={35} />
                  <h3>No clips in the queue</h3>
                  <p>
                    Add a local video to start building your searchable
                    collection.
                  </p>
                  {!config.readOnly && (
                    <button
                      className="button"
                      onClick={() => setModal("upload")}
                    >
                      Upload a clip <Plus size={16} />
                    </button>
                  )}
                </div>
              ) : (
                clips
                  .filter((c) => c.source !== "sample" && c.status !== "link")
                  .map((c) => (
                    <div className="job" key={c.id}>
                      <div className="job-icon">
                        {c.status === "ready" ? <CheckCircle2 /> : <Film />}
                      </div>
                      <div>
                        <strong>{c.title}</strong>
                        <p>{c.error || c.stage || c.status}</p>
                      </div>
                      <span className={`status ${c.status}`}>
                        {c.status.replace("_", " ")}
                      </span>
                      {!config.readOnly &&
                        ["error", "needs_config"].includes(c.status) && (
                          <button
                            className="button subtle"
                            onClick={() => retry(c.id)}
                          >
                            <RefreshCw size={15} />
                            Retry indexing
                          </button>
                        )}
                    </div>
                  ))
              )}
            </section>
          ) : (
            <section className="library">
              <div className="section-heading">
                <div>
                  <h2 ref={resultsHeading} tabIndex={-1}>
                    {results
                      ? "Found in the footage"
                      : tab === "Clip library"
                        ? "Your clip library"
                        : "The rabbit hole, organized."}{" "}
                  </h2>
                  <p>
                    {results
                      ? `Results for “${searched}”`
                      : tab === "Clip library"
                        ? "Every saved clip, with its indexing status."
                        : "Browse your clips or search for a moment."}
                  </p>
                </div>
                {results ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      setResults(null);
                      setQuery("");
                    }}
                  >
                    Clear search <X size={15} />
                  </button>
                ) : (
                  <span className="index-count">
                    <span />
                    {pagination.counts.ready} clips indexed
                  </span>
                )}
              </div>
              {results ? (
                <>
                  <p className="result-notice">{notice}</p>
                  {results.length === 0 ? (
                    <div className="empty">
                      <Search size={34} />
                      <h3>No confident match</h3>
                      <p>
                        Try a distinctive phrase, clothing color, or object.
                        Nothing is invented to fill the gaps.
                      </p>
                      {!!config.examples?.length && mode === "demo" && (
                        <div className="try-row centered">
                          <span>Try</span>
                          {config.examples.map((example) => (
                            <button
                              key={example}
                              type="button"
                              onClick={() => search(example)}
                            >
                              {example}
                              <ArrowRight size={13} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="results-grid">
                      {results.map(
                        (m, i) =>
                          (i === 0 || showOtherMatches) && (
                            <article
                              className={`result-card ${i === 0 ? "best" : "other-match"}`}
                              key={m.clip.id}
                            >
                              <button
                                className="result-art"
                                aria-label={`Play ${m.clip.title} at ${stamp(m.timestamp)}`}
                                onClick={() =>
                                  setSelected({
                                    clip: m.clip,
                                    time: m.timestamp,
                                    evidence: m.evidence,
                                  })
                                }
                              >
                                <Art clip={m.clip} />
                                <span className="play-circle">
                                  <Play size={23} fill="currentColor" />
                                </span>
                                <span className="duration">
                                  {stamp(m.clip.duration || 0)}
                                </span>
                              </button>
                              <div className="result-details">
                                <div className="result-label">
                                  {i === 0 && (
                                    <span className="best-match-label">
                                      Best match
                                    </span>
                                  )}
                                  <span
                                    className={
                                      m.confidence === "strong"
                                        ? "match-good"
                                        : m.partial
                                          ? "match-weak"
                                          : "match-likely"
                                    }
                                  >
                                    {m.confidence === "strong" ? (
                                      <CheckCircle2 size={14} />
                                    ) : (
                                      <Search size={14} />
                                    )}{" "}
                                    {m.confidence === "strong"
                                      ? "Strong match · words found in clip"
                                      : m.partial
                                        ? "Partial match · review evidence"
                                        : "Likely match · similar meaning"}
                                  </span>
                                  {m.clip.source === "sample" && (
                                    <span className="sample-label">SAMPLE</span>
                                  )}
                                </div>
                                <h3>{m.clip.title}</h3>
                                <p className="clip-meta">
                                  {[
                                    m.clip.streamer || "Local upload",
                                    m.clip.category,
                                    m.clip.duration
                                      ? stamp(m.clip.duration)
                                      : undefined,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                                <div className="evidence-list">
                                  {m.explanation && (
                                    <p className="match-explanation">
                                      {m.explanation}
                                    </p>
                                  )}
                                  {m.evidence.map((s, j) => (
                                    <button
                                      key={j}
                                      onClick={() =>
                                        setSelected({
                                          clip: m.clip,
                                          time: s.start,
                                          evidence: m.evidence,
                                        })
                                      }
                                    >
                                      {s.kind === "speech" ? (
                                        <AudioLines size={15} />
                                      ) : (
                                        <Eye size={15} />
                                      )}
                                      <span>{s.text}</span>
                                      <time>{stamp(s.start)}</time>
                                    </button>
                                  ))}
                                </div>
                                <button
                                  className="moment-button"
                                  onClick={() =>
                                    setSelected({
                                      clip: m.clip,
                                      time: m.timestamp,
                                      evidence: m.evidence,
                                    })
                                  }
                                >
                                  <Play size={14} fill="currentColor" />
                                  Jump to {stamp(m.timestamp)}
                                  <ArrowRight size={15} />
                                </button>
                              </div>
                            </article>
                          ),
                      )}
                    </div>
                  )}
                  {results.length > 1 && (
                    <button
                      className="other-matches-toggle"
                      aria-expanded={showOtherMatches}
                      onClick={() => setShowOtherMatches((value) => !value)}
                    >
                      {showOtherMatches
                        ? "Hide other matches"
                        : `See ${results.length - 1} other clips that match your search`}
                      <ChevronDown
                        size={16}
                        className={showOtherMatches ? "expanded" : ""}
                      />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="filter-row">
                    <div className="filters">
                      {(mode === "demo"
                        ? ["All moments", "My uploads"]
                        : ["All moments"]
                      ).map((f) => (
                        <button
                          key={f}
                          className={filter === f ? "selected" : ""}
                          aria-pressed={filter === f}
                          onClick={() => {
                            setFilter(f);
                            setPage(1);
                          }}
                        >
                          {f === "All moments" && <Layers size={14} />} {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="clip-grid">
                    {display.map((clip) => (
                      <article className="clip-card" key={clip.id}>
                        <button
                          className="card-art"
                          onClick={() => setSelected({ clip, time: 0 })}
                          aria-label={`Preview ${clip.title}`}
                        >
                          <Art clip={clip} />
                          <span className="card-source">
                            {clip.source === "sample"
                              ? "SAMPLE STORYBOARD"
                              : clip.source === "twitch"
                                ? "TWITCH"
                                : "LOCAL COLLECTION"}
                          </span>
                          <span className="card-play">
                            <Play size={18} fill="currentColor" />
                          </span>
                          <span className="duration">
                            {clip.duration ? stamp(clip.duration) : "LINK"}
                          </span>
                        </button>
                        <div className="card-body">
                          <div className="card-category">
                            <span />
                            {clip.category || "Your collection"}
                            <span
                              className={`card-status ${clip.status}`}
                              title={clip.stage}
                            >
                              {clip.status === "ready" ? (
                                <>
                                  <Check size={12} /> Indexed
                                </>
                              ) : (
                                clip.status.replace("_", " ")
                              )}
                            </span>
                          </div>
                          <h3>
                            <button
                              onClick={() => setSelected({ clip, time: 0 })}
                            >
                              {clip.title}
                            </button>
                          </h3>
                          <div className="card-footer">
                            <span
                              className={`creator-dot ${clip.thumbnail || ""}`}
                            >
                              {(clip.streamer || "Y")[0]}
                            </span>
                            <span>{clip.streamer || "Local upload"}</span>
                            <span className="evidence-count">
                              {clip.segmentCount ?? clip.segments.length}{" "}
                              moments
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {display.length === 0 && (
                    <div className="empty">
                      <Film size={32} />
                      <h3>This collection is waiting for its first moment.</h3>
                      {!config.readOnly && (
                        <button
                          className="button"
                          onClick={() =>
                            setModal(mode === "twitch" ? "twitch" : "upload")
                          }
                        >
                          Add clips <Plus size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
          {!results &&
            !libraryLoading &&
            !libraryError &&
            pagination.pages > 1 && (
              <nav className="library-pagination" aria-label="Clip pages">
                <button
                  className="button subtle"
                  disabled={page <= 1}
                  onClick={() => {
                    pageNavigation.current = true;
                    setPage((p) => p - 1);
                  }}
                >
                  Previous
                </button>
                <span role="status">
                  Page {pagination.page} of {pagination.pages} ·{" "}
                  {pagination.total} clips
                </span>
                <button
                  className="button subtle"
                  disabled={page >= pagination.pages}
                  onClick={() => {
                    pageNavigation.current = true;
                    setPage((p) => p + 1);
                  }}
                >
                  Next
                </button>
              </nav>
            )}
          <footer className="page-footer">
            <div className="footer-wordmark">
              clipdexer<span className="footer-dot">.</span>
            </div>
          </footer>
        </div>
      </main>
      {modal && (
        <Modal
          title={
            modal === "upload"
              ? "Bring your moments."
              : modal === "settings"
                ? "Your workspace, connected."
                : "Connect your channel."
          }
          close={() => setModal(null)}
        >
          {config.readOnly && modal !== "settings" ? (
            <ReadOnlyNote />
          ) : config.readOnly ? (
            <div className="settings">
              <ReadOnlyNote />
              <div className="setting-line">
                <span>
                  <strong>Semantic search</strong>
                  <small>
                    {config.ai
                      ? "Enabled · queries are embedded and compared with the saved index"
                      : "Keyword search only in this deployment"}
                  </small>
                </span>
                <span className={config.ai ? "green" : "muted"}>
                  {config.ai ? "Ready" : "Keywords"}
                </span>
              </div>
            </div>
          ) : modal === "upload" ? (
            <UploadForm
              ai={config.ai}
              onDone={async (clip) => {
                setModal(null);
                switchMode("demo");
                setTab(clip.status === "link" ? "Clip library" : "Processing");
                await refresh();
              }}
            />
          ) : modal === "settings" ? (
            <div className="settings">
              <p className="muted">
                Clipdexer runs locally. API credentials and Twitch tokens stay
                on the server.
              </p>
              <div className="setting-line">
                <span>
                  <strong>Demo collection</strong>
                  <small>Your local uploads and saved links</small>
                </span>
                <button
                  className="button subtle"
                  onClick={() => {
                    switchMode("demo");
                    setModal(null);
                  }}
                >
                  Use demo
                </button>
              </div>
              <div className="setting-line">
                <span>
                  <strong>AI indexing</strong>
                  <small>
                    {config.ai
                      ? "Configured · real indexing enabled"
                      : "Not configured · add an API key to index videos"}
                  </small>
                </span>
                <span className={config.ai ? "green" : "muted"}>
                  {config.ai ? "Ready" : "Setup needed"}
                </span>
              </div>
              <div className="config-note">
                To enable real indexing, add <code>OPENAI_API_KEY</code> to{" "}
                <code>.env.local</code> and restart the server. Transcription,
                vision, and embedding models are configurable.
              </div>
              <div className="setting-line">
                <span>
                  <strong>Twitch</strong>
                  <small>{config.user?.name || "No account connected"}</small>
                  {config.user && (
                    <button
                      className="text-button"
                      style={{ marginTop: 10 }}
                      onClick={() => {
                        switchMode("twitch");
                        setTab("Clip library");
                        setModal(null);
                      }}
                    >
                      Open Twitch collection <ArrowRight size={14} />
                    </button>
                  )}
                </span>
                <button
                  className="button subtle"
                  onClick={() => setModal("twitch")}
                >
                  Manage <ArrowRight size={15} />
                </button>
              </div>
              {config.user && (
                <button
                  className="text-button"
                  onClick={async () => {
                    await api("/api/twitch/disconnect", { method: "POST" });
                    switchMode("demo");
                    await refresh();
                  }}
                >
                  <LogOut size={15} /> Disconnect Twitch
                </button>
              )}
            </div>
          ) : (
            <TwitchPanel
              config={config}
              onImported={async () => {
                switchMode("twitch");
                await refresh();
              }}
            />
          )}
        </Modal>
      )}
      {selected && (
        <Modal title={selected.clip.title} close={() => setSelected(null)} wide>
          {detailError && selected.clip.segmentCount !== undefined ? (
            <div role="alert">
              <p>{detailError}</p>
              <button
                className="button"
                onClick={() => setDetailRetry((v) => v + 1)}
              >
                Try again
              </button>
            </div>
          ) : detailLoading || selected.clip.segmentCount !== undefined ? (
            <p role="status">Loading clip…</p>
          ) : (
            <Player selected={selected} />
          )}
        </Modal>
      )}
    </div>
  );
}
function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),video[controls],[tabindex="0"]',
        ) || [],
      ).filter(
        (item) => item.getClientRects().length > 0 && item.tabIndex >= 0,
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ReadOnlyNote() {
  return (
    <div className="config-note">
      This hosted demo is read-only: uploads, Twitch imports, and re-indexing
      are turned off so the shared collection stays intact. Every preloaded clip
      was indexed by the same pipeline you get locally. Clone the repo and run{" "}
      <code>npm run dev</code> to index your own clips.
    </div>
  );
}
function UploadForm({
  ai,
  onDone,
}: {
  ai: boolean;
  onDone: (clip: Clip) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const form = new FormData(e.currentTarget);
          if (file) form.set("file", file);
          const saved = await api("/api/clips", { method: "POST", body: form });
          onDone(saved);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted">
        Upload a local video to build its searchable transcript and visual
        index.
      </p>
      <label
        className={`dropzone ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          setFile(e.dataTransfer.files[0] || null);
        }}
      >
        <Upload size={30} />
        <strong>
          {file ? file.name : "Drop a clip here, or browse files"}
        </strong>
        <span>MP4, WebM, MOV, MKV · Up to 100 MB / 3 minutes</span>
        <input
          type="file"
          accept=".mp4,.webm,.mov,.mkv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <div className="form-grid">
        <label>
          Clip title <span>optional</span>
          <input
            name="title"
            placeholder="Give this moment a name"
            maxLength={160}
          />
        </label>
        <label>
          Streamer <span>optional</span>
          <input name="streamer" placeholder="Provided by you" maxLength={80} />
        </label>
      </div>
      <label className="form-label">
        Original Twitch clip URL <span>optional</span>
        <input name="url" type="url" placeholder="https://clips.twitch.tv/…" />
      </label>
      <p className="field-help">
        <LinkIcon size={13} /> A URL alone saves a link. It does not index the
        video.
      </p>
      <div className="config-note">
        {ai
          ? "Real indexing is enabled. Uploaded video audio and sampled frames are sent to your configured AI providers."
          : "AI is not configured. Your file will be saved as “needs configuration” with no invented results."}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button full" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <Plus size={17} />
        )}{" "}
        {busy
          ? "Saving your clip…"
          : file
            ? ai
              ? "Upload & index clip"
              : "Save video for indexing"
            : "Save Twitch link"}
      </button>
    </form>
  );
}
function Player({
  selected,
}: {
  selected: { clip: Clip; time: number; evidence?: Match["evidence"] };
}) {
  const { clip, time } = selected;
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [embed, setEmbed] = useState(false);
  const [now, setNow] = useState(time);
  const matched = new Set(
    (selected.evidence || []).map((s) => `${s.kind}:${s.start}:${s.text}`),
  );
  const timeline = [...clip.segments].sort(
    (a, b) => a.start - b.start || a.kind.localeCompare(b.kind),
  );
  // Fall back to the search evidence while the full index is unavailable.
  const rows = timeline.length ? timeline : selected.evidence || [];
  const active = rows.reduce<number>(
    (found, s, i) => (s.start <= now + 0.25 ? i : found),
    -1,
  );
  useEffect(() => {
    if (ref.current) ref.current.currentTime = time;
    setNow(time);
  }, [time]);
  const isSample = clip.source === "sample";
  return (
    <div className="player-content">
      {isSample && (
        <div className="sample-disclaimer">
          <Film size={16} /> Authored sample storyboard · synthetic captions,
          not real streamer footage or AI output.
        </div>
      )}
      {embed && clip.twitchId ? (
        <iframe
          title="Twitch clip player"
          className="video-player"
          src={`https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip.twitchId)}&parent=${window.location.hostname}&autoplay=false`}
          allowFullScreen
        />
      ) : clip.source === "link" ? (
        <div className="empty">
          <LinkIcon size={35} />
          <h3>Link saved, video not indexed</h3>
          <p>Upload the actual video file to search its content.</p>
        </div>
      ) : (
        <video
          key={clip.id}
          className="video-player"
          ref={ref}
          controls
          playsInline
          preload="metadata"
          src={
            isSample
              ? `/samples/${clip.thumbnail}.mp4`
              : `/api/media/${clip.id}`
          }
          onLoadedMetadata={() => {
            if (!ref.current) return;
            ref.current.currentTime = time;
            // Opening a search result is a deliberate click: start at the match.
            if (selected.evidence) ref.current.play().catch(() => {});
          }}
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onError={() => setFailed(true)}
        />
      )}{" "}
      {failed && (
        <p className="form-error">
          Preview unavailable in this format. Try an MP4 upload, or open the
          original clip.
        </p>
      )}
      <div className="player-meta">
        <span>
          {[clip.streamer || "Local upload", clip.category]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {clip.twitchUrl && (
          <a
            className="text-button"
            href={clip.twitchUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open on Twitch <ExternalLink size={14} />
          </a>
        )}
      </div>
      {clip.twitchId && (
        <button className="text-button" onClick={() => setEmbed(!embed)}>
          {embed
            ? "Use local timestamped preview"
            : "Use official Twitch player"}{" "}
          <Play size={14} />
        </button>
      )}
      {embed && (
        <p className="field-help">
          Deleted clips and unavailable Twitch embeds may not play. The
          downloaded preview supports precise seeking.
        </p>
      )}
      <h3 className="evidence-heading">
        {isSample ? "Sample index evidence" : "Timestamped index"}
        {rows.length > 0 && (
          <small>
            {rows.length} moments · click any line to jump
            {matched.size > 0 ? " · highlighted lines matched your search" : ""}
          </small>
        )}
      </h3>
      <div className="evidence-list player-evidence">
        {rows.map((s, i) => (
          <button
            key={i}
            className={[
              matched.has(`${s.kind}:${s.start}:${s.text}`) ? "matched" : "",
              i === active && !embed ? "playing" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={i === active && !embed ? "time" : undefined}
            onClick={() => {
              setEmbed(false);
              setTimeout(() => {
                if (ref.current) {
                  ref.current.currentTime = s.start;
                  ref.current.play().catch(() => {});
                }
              }, 0);
            }}
          >
            {s.kind === "speech" ? (
              <AudioLines size={17} aria-label="Speech" />
            ) : (
              <Eye size={17} aria-label="Visual" />
            )}
            <time>{stamp(s.start)}</time>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
      {!clip.segments.length && (
        <p className="muted">
          {clip.error ||
            clip.stage ||
            "No index yet. This clip has not been AI-processed."}
        </p>
      )}
    </div>
  );
}
function TwitchPanel({
  config,
  onImported,
}: {
  config: Config;
  onImported: () => void;
}) {
  const [role, setRole] = useState("broadcaster");
  const [broadcaster, setBroadcaster] = useState(config.user?.id || "");
  const [clips, setClips] = useState<TwitchClip[]>([]);
  const [cursor, setCursor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string[]>([]);
  async function load(more = false) {
    setBusy(true);
    setError("");
    try {
      const p = new URLSearchParams({ broadcaster });
      if (more) p.set("after", cursor);
      const result = await api(`/api/twitch/clips?${p}`);
      setClips(more ? [...clips, ...result.data] : result.data);
      setCursor(result.pagination?.cursor || "");
      if (!result.data.length && !more)
        setError("No clips found for this channel.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="muted">
        Connect as a broadcaster or editor, then import a few authorized clips
        through Twitch’s official API.
      </p>
      {!config.twitch ? (
        <div className="config-note">
          Add <code>TWITCH_CLIENT_ID</code> and{" "}
          <code>TWITCH_CLIENT_SECRET</code> to <code>.env.local</code>. Register{" "}
          <code>http://localhost:3000/api/twitch/callback</code> as your OAuth
          redirect URL, then restart.
        </div>
      ) : !config.user ? (
        <>
          <label className="form-label">
            Connect as
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="broadcaster">Broadcaster: my channel</option>
              <option value="editor">Editor: an authorized channel</option>
            </select>
          </label>
          <p className="field-help">
            Requests only{" "}
            {role === "editor" ? "editor:manage:clips" : "channel:manage:clips"}
            , required by Twitch to download clips.
          </p>
          <a
            className="button full twitch-button"
            href={`/api/twitch/connect?role=${role}`}
          >
            <Radio size={18} />
            Connect with Twitch <ArrowUpRight size={17} />
          </a>
        </>
      ) : (
        <>
          <div className="connected">
            <CheckCircle2 size={18} /> Connected as {config.user.name}
          </div>
          <label className="form-label">
            Broadcaster ID
            <input
              value={broadcaster}
              onChange={(e) => {
                setBroadcaster(e.target.value);
                setClips([]);
                setCursor("");
              }}
              inputMode="numeric"
            />
          </label>
          <button
            className="button full"
            disabled={busy}
            onClick={() => load()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Layers size={16} />
            )}
            Browse authorized clips
          </button>
          <div className="twitch-list">
            {clips.map((c) => (
              <div key={c.id}>
                <div>
                  <strong>{c.title}</strong>
                  <small>
                    {c.broadcaster_name} · {stamp(c.duration)}
                    {!c.video_id ? " · source VOD unavailable" : ""}
                  </small>
                </div>
                <button
                  className="button subtle"
                  disabled={busy || done.includes(c.id)}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await api("/api/twitch/clips", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: c.id }),
                      });
                      setDone([...done, c.id]);
                      onImported();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {done.includes(c.id) ? (
                    <Check size={16} />
                  ) : (
                    <Plus size={16} />
                  )}{" "}
                  {done.includes(c.id) ? "Imported" : "Import"}
                </button>
              </div>
            ))}
          </div>
          {cursor && (
            <button
              className="button full subtle"
              disabled={busy}
              onClick={() => load(true)}
            >
              Load more clips <ChevronDown size={16} />
            </button>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="field-help">
        An import requires permission to download the actual clip. Missing or
        deleted videos are never marked as indexed.
      </p>
    </div>
  );
}
