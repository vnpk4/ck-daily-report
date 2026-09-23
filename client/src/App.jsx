import React, { useState } from 'react';
import Navbar from './components/Navbar';
import GuestUploadPage from './pages/GuestUploadPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import Toast from './components/Toast';

export default function App() {
  const [currentTab, setCurrentTab] = useState('guest'); // 'guest' | 'admin'
  const [toasts, setToasts] = useState([]);

  const showToast = (type, message, title = '') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message, title }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main style={{ flex: 1 }}>
        {currentTab === 'guest' ? (
          <GuestUploadPage onShowToast={showToast} />
        ) : (
          <AdminDashboardPage onShowToast={showToast} />
        )}
      </main>

      <footer
        style={{
          textAlign: 'center',
          padding: '2rem 1rem 2.5rem',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto'
        }}
      >
        <p>© 2026 THU THẬP ẢNH BÁO CÁO</p>
      </footer>

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
