import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';  // 404 에러 방지를 위해 명시적으로 Import
import './styles.css'; 

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