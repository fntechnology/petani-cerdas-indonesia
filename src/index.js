// Ensure file is detected by Vercel
import React from 'react';
import ReactDOM from 'react-dom';
import App from './app';

console.log('Index.js loaded');

// Trigger build with a minor change

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
