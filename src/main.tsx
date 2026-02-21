import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'
import './styles/tokens.css'

// A simple placeholder component
const App = () => (
  <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: 'var(--color-neutral-charcoal)' }}>
    <h1>StudioFlow</h1>
    <p>A design engineering system by Alexander Beck Studio.</p>
    <div data-sfid="hero:title">This is a title with a stable ID.</div>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
