// Voice entry with the phone's own speech recognition (Chrome on Android; it needs a connection).

const Rec = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const canListen = () => !!Rec;

let current = null;

/** Listens once; onText(text, final) is called as words come in. Returns a stop function. */
export function listen({ lang = 'en-US', onText, onEnd, onError }) {
  if (!Rec) { onError && onError('Voice entry needs Chrome on an Android phone.'); return () => {}; }
  if (current) current.abort();
  const r = new Rec();
  r.lang = lang; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  r.onresult = e => {
    const text = [...e.results].map(x => x[0].transcript).join(' ');
    onText && onText(text, e.results[e.results.length - 1].isFinal);
  };
  r.onerror = e => onError && onError(e.error === 'not-allowed' ? 'Allow the microphone for this app, then try again.' : e.error === 'network' ? 'Voice entry needs a connection.' : e.error === 'no-speech' ? 'Nothing was heard. Try again.' : 'Voice entry stopped.');
  r.onend = () => { current = null; onEnd && onEnd(); };
  current = r;
  r.start();
  return () => r.stop();
}
