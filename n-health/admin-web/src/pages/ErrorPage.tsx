import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ErrorPage.css';

interface ErrorPageProps {
  code?: number;
  title?: string;
  message?: string;
}

export function ErrorPage({ code = 404, title = 'Page Not Found', message = 'Sorry, we couldn\'t find the page you\'re looking for.' }: ErrorPageProps) {
  const navigate = useNavigate();

  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-icon">
          {code === 404 && '🔍'}
          {code === 500 && '⚠️'}
          {code === 403 && '🚫'}
          {!code && '❌'}
        </div>

        <div className="error-code">{code}</div>
        <h1 className="error-title">{title}</h1>
        <p className="error-message">{message}</p>

        <div className="error-actions">
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go to Home
          </button>
          <button className="btn btn-outline" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>

        {/* Quick Links */}
        <div className="error-links">
          <h3>Helpful Links</h3>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/login">Sign In</a></li>
            <li><a href="/signup">Sign Up</a></li>
            <li><a href="/">Contact Support</a></li>
          </ul>
        </div>
      </div>

      {/* Illustration */}
      <div className="error-illustration">
        <div className="illustration-content">
          {code === 404 && (
            <>
              <div className="illustration-item">🏥</div>
              <div className="illustration-item delayed">🔍</div>
              <div className="illustration-item delayed-2">📍</div>
            </>
          )}
          {code === 500 && (
            <>
              <div className="illustration-item">⚙️</div>
              <div className="illustration-item delayed">🔧</div>
              <div className="illustration-item delayed-2">⚡</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
