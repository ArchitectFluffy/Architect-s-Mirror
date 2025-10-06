# Architect’s Mirror

Paste plain text → generate an interactive system map (React + Canvas). Drag nodes, export PNG/JSON. No backend.

## Use
1) Copy `ArchitectsMirror.jsx` into a React + Tailwind app’s `src/`.
2) Render it:
```jsx
import ArchitectsMirror from "./ArchitectsMirror.jsx";
export default function App(){ return <ArchitectsMirror/> }
