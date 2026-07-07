import OpenAI from "openai";
 
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});
 
let currentAudio = null;
let currentId = null;
let loadingId = null;
let playToken = 0;
 
const audioCache = new Map();
const loadingCache = new Map();
 
async function getAudioUrl(text, id) {
  if (audioCache.has(id)) return audioCache.get(id);
  if (loadingCache.has(id)) return loadingCache.get(id);
 
  const promise = openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "nova",
    instructions:
      "You are a happy, energetic 12-year-old Australian girl reading your own diary. Speak naturally with curiosity, excitement and wonder. Sound warm and genuine, not robotic or like an adult narrator.",
    input: text,
  }).then(async (mp3) => {
    const buffer = await mp3.arrayBuffer();
    const blob = new Blob([buffer], { type: "audio/mp3" });
    const url = URL.createObjectURL(blob);
 
    audioCache.set(id, url);
    loadingCache.delete(id);
 
    return url;
  });
 
  loadingCache.set(id, promise);
  return promise;
}

export function preloadSpeech(text, id = "memory") {
  getAudioUrl(text, id).catch(console.error);
}
 
export function stopSpeaking() {
  playToken++;
 
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
 
  currentAudio = null;
  currentId = null;
  loadingId = null;
}
 
export async function speak(text, id = "memory") {
  // If same memory is already playing OR loading, stop it.
  if (currentId === id || loadingId === id) {
    stopSpeaking();
    return;
  }
 
  stopSpeaking();
 
  const thisToken = ++playToken;
  loadingId = id;
 
  try {
    const url = await getAudioUrl(text, id);
 
    // If user clicked stop/another memory while audio was loading, do nothing.
    if (thisToken !== playToken || loadingId !== id) return;
 
    const audio = new Audio(url);
 
    currentAudio = audio;
    currentId = id;
    loadingId = null;
 
    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null;
        currentId = null;
      }
    };
 
    await audio.play();
  } catch (err) {
    if (thisToken === playToken) {
      currentAudio = null;
      currentId = null;
      loadingId = null;
    }
    throw err;
  }
}