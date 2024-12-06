// Ensure file is detected by Vercel
console.log('Index.js loaded');

// Trigger build with a minor change
import React from 'react';
import ReactDOM from 'react-dom';
import App from './app';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
