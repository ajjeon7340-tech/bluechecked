import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// import './index.css'; // Removed to rely on Tailwind CDN and prevent 404s

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);