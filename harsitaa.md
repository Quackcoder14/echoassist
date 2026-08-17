# EchoAssist — Task Brief: HARSITAA (Dashboard / Demo — Vite + React)

## Your role
Build the end-to-end demo dashboard as a **Vite + React app**. This is what judges see and interact with live. You do NOT call any Python function directly — you call a backend API (Dhanush owns it) over HTTP. You don't need to understand model/DSP internals, just the API contract below.

## Branch
```
git checkout -b dashboard
```
Always work on this branch. Never push to `main` directly.

## Files you own
```
frontend/            <- entire Vite project lives here
  src/
    App.jsx
    components/
      FileUpload.jsx
      WaveformView.jsx
      ClassificationResult.jsx
      GradCamOverlay.jsx
      SegmentationOverlay.jsx
      MetricsPanel.jsx
    api.js            <- all fetch calls to the backend, centralized here
```

## Setup
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install axios wavesurfer.js
npm run dev
```
This runs the dev server on `http://localhost:5173`. The backend (Dhanush's FastAPI app) runs separately on `http://localhost:8000` — you're calling across ports, so CORS is already handled on his end. Don't try to merge the two into one process.

## The API contract (backend is NOT ready yet — build against this spec with mock data first)

Base URL: `http://localhost:8000`

### `POST /check-validity`
Send: `multipart/form-data` with the uploaded `.wav` file under key `file`
Receive:
```json
{ "valid": true, "reason": "ok", "duration_sec": 8.2 }
```
or
```json
{ "valid": false, "reason": "silence", "duration_sec": 2.1 }
```

### `POST /predict`
Send: same file upload
Receive:
```json
{ "label": "murmur", "confidence": 0.87, "logits": [0.05, 0.87, 0.05, 0.03] }
```

### `POST /gradcam`
Send: same file upload
Receive: a PNG image (binary response) — the overlayed heatmap on the spectrogram, ready to display directly in an `<img>` tag via a blob URL.

### `GET /segmentations/{recording_id}`
Receive:
```json
{ "segments": [["S1", 0.0, 0.12], ["systole", 0.12, 0.35], ["S2", 0.35, 0.45], ["diastole", 0.45, 0.9]] }
```
Returns `{"segments": []}` if unavailable — this is expected, not an error.

### `GET /metrics`
Receive precomputed evaluation results (for an optional metrics panel):
```json
{
  "accuracy": 0.84,
  "macro_f1": 0.79,
  "per_class": { "normal": {"precision":0.9,"recall":0.88,"f1":0.89,"support":120}, "...": {} },
  "confusion_matrix_url": "/static/confusion_matrix.png"
}
```

## `src/api.js` — centralize all calls here
```javascript
import axios from "axios";

const BASE_URL = "http://localhost:8000";

export async function checkValidity(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post(`${BASE_URL}/check-validity`, form);
  return res.data;
}

export async function predict(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post(`${BASE_URL}/predict`, form);
  return res.data;
}

export async function getGradcamImageUrl(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post(`${BASE_URL}/gradcam`, form, { responseType: "blob" });
  return URL.createObjectURL(res.data);
}

export async function getSegmentation(recordingId) {
  const res = await axios.get(`${BASE_URL}/segmentations/${recordingId}`);
  return res.data.segments;
}

export async function getMetrics() {
  const res = await axios.get(`${BASE_URL}/metrics`);
  return res.data;
}
```
Every component imports from here. Never write a raw `fetch`/`axios` call inside a component — keep it centralized so if an endpoint URL changes, you fix it in one place.

## Important: start with MOCK data
Dhanush's backend may not be running when you start. **Do not wait.** Build `api.js` with mock versions first:
```javascript
export async function predict(file) {
  await new Promise(r => setTimeout(r, 800)); // fake latency
  const labels = ["normal", "murmur", "extrasystole", "artifact"];
  return { label: labels[Math.floor(Math.random()*4)], confidence: 0.6 + Math.random()*0.35, logits: [0.1,0.2,0.3,0.4] };
}
```
Once the real backend is up, swap the function bodies for the real `axios` calls shown above — component code should not need to change, since the function names/return shapes are locked.

## App flow (`App.jsx`)
1. **Upload**: `FileUpload.jsx` — drag-and-drop or file input for `.wav`, holds the `File` object in state
2. **Validity check FIRST**: on upload, call `checkValidity(file)` before anything else
   - If `valid === false`: show `reason` clearly (e.g. "This recording appears to be silent or unusable"), stop — don't call `/predict`
   - If `valid === true`: proceed
3. **Waveform**: `WaveformView.jsx` — use `wavesurfer.js` to render the waveform from the uploaded file directly in-browser (no backend call needed for this)
4. **Classification**: `ClassificationResult.jsx` — call `predict(file)`, show label (large/clear) and confidence as a percentage
5. **Explainability**: `GradCamOverlay.jsx` — call `getGradcamImageUrl(file)`, render the returned blob URL in an `<img>`
6. **Segmentation overlay** (if available): `SegmentationOverlay.jsx` — call `getSegmentation(id)`, draw colored regions for S1/systole/S2/diastole on top of or below the waveform
7. **Optional**: `MetricsPanel.jsx` — collapsible panel showing `getMetrics()` output + the confusion matrix image

## Layout suggestion
```jsx
function App() {
  const [file, setFile] = useState(null);
  const [validity, setValidity] = useState(null);
  const [result, setResult] = useState(null);

  return (
    <div>
      <h1>EchoAssist — Heart Sound Analysis</h1>
      <p className="caption">Decision-support tool. Not a diagnostic system.</p>
      <FileUpload onFileSelected={handleUpload} />
      {validity && !validity.valid && <ErrorBanner reason={validity.reason} />}
      {validity?.valid && (
        <>
          <WaveformView file={file} />
          <ClassificationResult file={file} />
          <GradCamOverlay file={file} />
          <SegmentationOverlay file={file} />
        </>
      )}
    </div>
  );
}
```

## Testing before you push
1. Test with mock `api.js` first — confirm the full UI flow works with a real uploaded `.wav` file, no console errors
2. Test the invalid-file path deliberately — simulate `valid: false` in your mock, confirm a clean error banner shows instead of a broken UI
3. Once Dhanush's backend is running (`http://localhost:8000`), swap `api.js` to the real calls and re-test end-to-end. Run `npm run dev` and his backend simultaneously — check the network tab for CORS errors if requests fail silently

## Push instructions
```bash
git add .
git commit -m "Add Vite/React dashboard"
git push -u origin dashboard
```
Push early with the mock-data version working — a visually working UI with fake data is genuinely useful for the team to see, don't wait for the real backend.

## What NOT to do
- Don't write any Python or reimplement backend logic — you only call the API
- Don't hardcode `localhost:8000` in more than one place — keep it as the `BASE_URL` constant in `api.js`
- Don't skip the validity check step — this is what satisfies the "graceful degradation" requirement and is easy for judges to test live
- Don't build a router/multi-page app — this is a single-page tool, keep it simple

## Definition of done
- `npm run dev` runs the app without errors
- Full flow works: upload → validity check → waveform → classification + confidence → Grad-CAM overlay → (segmentation overlay if available)
- Bad input (silent/corrupted file) shows a clear message, no crash
- Pushed to `dashboard` branch
