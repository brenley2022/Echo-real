import { speak, preloadSpeech } from "./src/openaiTTS.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase.js";
import "./styles.css";

const KEY = "echo_memories_v2";

const STAR_SPOTS = [
  { x: 60, y: 18 },
  { x: 68, y: 16 },
  { x: 76, y: 20 },
  { x: 84, y: 15 },
  { x: 90, y: 22 },
];

function App() {
  const [locked, setLocked] = useState(true);
  const [pass, setPass] = useState("");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const [author, setAuthor] = useState("Brendan");
  const [memories, setMemories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Da Nang");

  const recRef = useRef(null);
  const keepListening = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`
          );
          const data = await res.json();

          const suburb =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            "";

          const state = data.address?.state || "";
          const country = data.address?.country || "";

          setLocation([suburb, state, country].filter(Boolean).join(", "));
        } catch (err) {
          console.error(err);
        }
      },
      () => {}
    );
  }, []);

  useEffect(() => {
    async function loadEntries() {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        const saved = JSON.parse(localStorage.getItem(KEY) || "[]");
        setMemories(saved);
        return;
      }

      const mapped = data.map((e) => ({
        id: e.id,
        title: e.title,
        entry: e.journal_text,
        raw: e.raw_text,
        mood: e.mood,
        topic: e.topic,
        author: e.author,
        location: e.location,
        photos: e.photos || [],
        date: e.created_at,
        favourite: false,
      }));

      setMemories(mapped);
    }

    loadEntries();
    speechSynthesis.getVoices();
  }, []);

  function saveLocal(items) {
    setMemories(items);
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function startTalk() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      alert("Voice dictation is not supported in this browser. Try Chrome.");
      return;
    }

    keepListening.current = true;

    const rec = new SR();
    rec.lang = "en-AU";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setListening(true);

    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      setText((t) => `${t} ${said}`.trim());
    };

    rec.onend = () => {
      if (keepListening.current) {
        setTimeout(() => {
          try {
            rec.start();
          } catch {}
        }, 250);
      } else {
        setListening(false);
      }
    };

    recRef.current = rec;
    rec.start();
  }

  function stopTalk() {
    keepListening.current = false;
    recRef.current?.stop();
    setListening(false);
  }

  function addPhotos(e) {
    const files = Array.from(e.target.files || []);

    const readers = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers).then((newPhotos) => {
      setPhotos((p) => [...p, ...newPhotos]);
    });
  }

  async function createMemory() {
    if (!text.trim()) {
      alert("Write or say something first.");
      return;
    }

    setBusy(true);

    let ai = null;

    try {
      const res = await supabase.functions.invoke("generate-entry", {
        body: {
          rawText: text,
          author,
          today: new Date().toLocaleDateString("en-AU", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          location,
        },
      });

      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);

      ai = res.data;
    } catch (err) {
      console.error(err);
      alert("AI failed for now, so Echo saved a basic memory.");
    }

    const memory = {
      id: crypto.randomUUID(),
      title: ai?.title || text.trim().split(" ").slice(0, 7).join(" "),
      entry: ai?.journal_text || text,
      raw: text,
      photos,
      mood: ai?.mood || "Reflective",
      topic: ai?.topic || "Memory",
      author,
      location,
      dateISO: new Date().toISOString(),
      date: new Date().toLocaleString("en-AU"),
      x: 8 + Math.random() * 82,
      y: 100 + Math.random() * 200,
      favourite: false,
    };

    const next = [memory, ...memories];
    saveLocal(next);

    const { data, error: insertError } = await supabase
      .from("entries")
      .insert({
        title: memory.title,
        raw_text: memory.raw,
        journal_text: memory.entry,
        mood: memory.mood,
        topic: memory.topic,
        author: memory.author,
        location: memory.location,
        photos: memory.photos,
      })
      .select();

    console.log("Supabase result:", data);

    if (insertError) {
      alert(JSON.stringify(insertError));
      console.error(insertError);
    }

    setSelected(memory);
    preloadSpeech(memory.entry, memory.id);
    setText("");
    setPhotos([]);
    setBusy(false);
  }

  async function readMemory(m) {
    try {
      await speak(m.entry, m.id);
    } catch (err) {
      console.error(err);
      alert("Could not read memory.");
    }
  }

  function toggleFavourite(id) {
    const next = memories.map((m) =>
      m.id === id ? { ...m, favourite: !m.favourite } : m
    );

    saveLocal(next);
    setSelected(next.find((m) => m.id === id));
  }

  function deleteMemory(id) {
    const next = memories.filter((m) => m.id !== id);
    saveLocal(next);
    setSelected(null);
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    if (!q) return memories;

    return memories.filter((m) =>
      [m.title, m.entry, m.raw, m.mood, m.topic, m.date]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, memories]);

  if (locked) {
    return (
      <div className="sky">
        <div className="moon"></div>
        <div className="loginCard">
          <h1>🦋 Echo</h1>
          <p>Every memory becomes a little light.</p>
          <input
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Passcode"
          />
          <button onClick={() => pass === "1234" && setLocked(false)}>
            Unlock ✨
          </button>
          <small>Demo passcode: 1234</small>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="skyBg">
        <div className="moon"></div>
        <div className="cloud c1"></div>
        <div className="cloud c2"></div>
        <div className="shootingStar"></div>

        {filtered.map((m, i) => {
          const spot = STAR_SPOTS[i % STAR_SPOTS.length];

          return (
            <button
              key={m.id}
              className={m.favourite ? "star favourite" : "star"}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
              }}
              title={`${m.title} - ${m.date}`}
onClick={() => {
  setSelected(m);
  preloadSpeech(m.entry, m.id);
}}
onTouchEnd={(e) => {
  e.preventDefault();
  setSelected(m);
  preloadSpeech(m.entry, m.id);
}}
            ></button>
          );
        })}
      </div>

      <main className="panel">
        <h1>🌌 Echo</h1>
        <p className="sub">Talk naturally. Echo turns the mess into a memory.</p>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: "bold",
            }}
          >
            Whose memory is this?
          </label>

          <select
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              fontSize: "16px",
            }}
          >
            <option>Brendan</option>
            <option>Linley</option>
            <option>Aubrey</option>
          </select>

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "12px",
              borderRadius: "12px",
              fontSize: "16px",
            }}
          />
        </div>

        <div className="actions">
          {!listening ? (
            <button onClick={startTalk}>🎙️ Start talking</button>
          ) : (
            <button onClick={stopTalk} className="stop">
              🛑 Stop listening
            </button>
          )}

          <button onClick={createMemory} disabled={busy}>
            {busy ? "✨ AI is writing..." : "Save as star ✨"}
          </button>

          <button
            onClick={() => document.getElementById("photoPicker").click()}
            style={{ width: "100%", marginTop: "10px" }}
          >
            📷 Add Photos {photos.length ? `(${photos.length})` : ""}
          </button>

          <input
            id="photoPicker"
            type="file"
            accept="image/*"
            multiple
            onChange={addPhotos}
            style={{ display: "none" }}
          />

          {photos.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "10px",
                overflowX: "auto",
                paddingBottom: "6px",
              }}
            >
              {photos.map((photo, i) => (
                <img
                  key={i}
                  src={photo}
                  alt=""
                  style={{
                    width: "80px",
                    height: "80px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    border: "2px solid rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write or speak your thoughts..."
        />

        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your memory sky..."
        />

        <div style={{ marginTop: "12px", maxHeight: "180px", overflowY: "auto" }}>
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setSelected(m);
                preloadSpeech(m.entry, m.id);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                marginBottom: "8px",
                padding: "10px",
                borderRadius: "12px",
              }}
            >
              <strong>{m.title}</strong>
              <br />
              <small>
                {m.date} · {m.mood} · {m.topic}
              </small>
            </button>
          ))}
        </div>

        <p className="count">{memories.length} memories saved</p>
      </main>

      {selected && (
        <aside className="memoryCard">
          <button className="close" onClick={() => setSelected(null)}>
            ×
          </button>

          <p className="label">Selected Memory</p>
          <h2>✨ {selected.title}</h2>
          <small>
            {selected.date} · {selected.mood} · {selected.topic}
          </small>

          <p>{selected.entry}</p>

          {selected.photos?.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
                marginTop: "12px",
              }}
            >
              {selected.photos.map((photo, i) => (
                <img
                  key={i}
                  src={photo}
                  alt=""
                  style={{
                    width: "100%",
                    height: "90px",
                    objectFit: "cover",
                    borderRadius: "10px",
                  }}
                />
              ))}
            </div>
          )}

          <details>
            <summary>Original words</summary>
            <p>{selected.raw}</p>
          </details>

          <div className="memoryActions">
            <button onClick={() => readMemory(selected)}>🔊 Read it</button>
            <button onClick={() => toggleFavourite(selected.id)}>
              ❤️ {selected.favourite ? "Unfavourite" : "Favourite"}
            </button>
            <button className="delete" onClick={() => deleteMemory(selected.id)}>
              Delete
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);