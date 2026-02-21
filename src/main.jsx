import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import SharedView from './SharedView.jsx';

function Router() {
  const path = window.location.pathname;
  const match = path.match(/^\/game\/(.+)$/);

  if (match) {
    return <SharedView gameId={match[1]} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
