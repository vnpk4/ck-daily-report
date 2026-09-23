import React from 'react';
import { ShieldCheck, UploadCloud } from 'lucide-react';

export default function Navbar({ currentTab, setCurrentTab }) {
  return (
    <header className="navbar">
      <a 
        href="#" 
        className="brand" 
        onClick={(e) => { e.preventDefault(); setCurrentTab('guest'); }}
        title="Trang chủ - Gửi Ảnh Thực Hiện"
      >
        <div className="cand-emblem-btn">
          <img 
            src="/cand-logo.png" 
            alt="Huy hiệu Công An Nhân Dân Việt Nam" 
            className="cand-emblem-img" 
          />
        </div>
        <div className="brand-titles">
          <span className="brand-main">CÔNG AN PHƯỜNG CẦU KIỆU</span>
          <span className="brand-sub">HỆ THỐNG THU THẬP ẢNH BÁO CÁO</span>
        </div>
      </a>

      <nav className="nav-links">
        <button
          className={`nav-btn ${currentTab === 'guest' ? 'active' : ''}`}
          onClick={() => setCurrentTab('guest')}
        >
          <UploadCloud size={16} />
          <span>Gửi Ảnh Thực Hiện</span>
        </button>

        <button
          className={`nav-btn ${currentTab === 'admin' ? 'active' : ''}`}
          onClick={() => setCurrentTab('admin')}
        >
          <ShieldCheck size={16} />
          <span>Quản Trị Viên</span>
        </button>
      </nav>
    </header>
  );
}
