import React from 'react';
import { ShieldCheck, UploadCloud, Trophy } from 'lucide-react';

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
          <span className="nav-text-full">Gửi Ảnh Thực Hiện</span>
          <span className="nav-text-short">Gửi Ảnh</span>
        </button>

        <button
          className={`nav-btn ${currentTab === 'ranking' ? 'active' : ''}`}
          onClick={() => setCurrentTab('ranking')}
        >
          <Trophy size={16} />
          <span className="nav-text-full">Bảng Xếp Hạng</span>
          <span className="nav-text-short">Xếp Hạng</span>
        </button>

        <button
          className={`nav-btn ${currentTab === 'admin' ? 'active' : ''}`}
          onClick={() => setCurrentTab('admin')}
        >
          <ShieldCheck size={16} />
          <span className="nav-text-full">Quản Trị Viên</span>
          <span className="nav-text-short">Quản Trị</span>
        </button>
      </nav>
    </header>
  );
}
