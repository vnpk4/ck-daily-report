import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  Calendar, 
  MapPin, 
  Tag, 
  Trash2, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Edit3, 
  FileArchive, 
  Layers, 
  Clock, 
  Image as ImageIcon,
  Eye,
  Check,
  X,
  Trophy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  UploadCloud,
  AlertTriangle
} from 'lucide-react';
import Lightbox from '../components/Lightbox';
import CskvRankingPage from './CskvRankingPage';

const DEFAULT_CATEGORIES = [
  'Cài đặt ứng dụng SOS',
  'Thực hiện định danh mức 2',
  'Góp ý cải cách thủ tục hành chính',
  'Góp ý sửa đổi bộ luật hình sự'
];

// Helper to safely format report time converting UTC timestamps to local Vietnam time
const formatReportTime = (timeStr) => {
  if (!timeStr) return '';
  let normalized = timeStr;
  if (!normalized.endsWith('Z') && !normalized.includes('+') && !normalized.includes('T')) {
    normalized = normalized.replace(' ', 'T') + 'Z';
  } else if (!normalized.endsWith('Z') && !normalized.includes('+')) {
    normalized = normalized + 'Z';
  }
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return timeStr;
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export default function AdminDashboardPage({ onShowToast }) {
  // Admin Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('ck_admin_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [adminSubTab, setAdminSubTab] = useState('reports'); // 'reports' | 'ranking'

  // Regions & Categories State
  const [regions, setRegions] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // Filters State
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('all'); // 'today', 'yesterday', '7days', 'all', 'custom'

  // Data State
  const [reports, setReports] = useState([]);
  const [meta, setMeta] = useState({ totalReports: 0, totalImages: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // 10, 20, 50

  const totalReportsCount = reports.length;
  const totalPages = Math.max(1, Math.ceil(totalReportsCount / itemsPerPage));

  // Tự động điều chỉnh trang nếu vượt quá số trang hiện tại
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Danh sách báo cáo sau khi cắt theo trang
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return reports.slice(start, start + itemsPerPage);
  }, [reports, currentPage, itemsPerPage]);

  // Region Edit Modal State
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState(null);
  const [editRegionName, setEditRegionName] = useState('');
  const [isSavingRegion, setIsSavingRegion] = useState(false);

  // Database Backup / Restore Modal State
  const [showDbModal, setShowDbModal] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [dbModalPin, setDbModalPin] = useState(() => sessionStorage.getItem('ck_admin_pin') || '');

  // Lightbox State
  const [activeLightboxImg, setActiveLightboxImg] = useState(null);
  const [lightboxImagesList, setLightboxImagesList] = useState([]);

  // Check login on load
  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  // Fetch reports when filters change
  useEffect(() => {
    if (isAuthenticated) {
      setCurrentPage(1);
      fetchReports();
    }
  }, [selectedRegion, selectedCategory, startDate, endDate, isAuthenticated]);

  const loadInitialData = async () => {
    await Promise.all([fetchRegions(), fetchCategories(), fetchStats(), fetchReports()]);
  };

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    setPinError('');
    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('ck_admin_auth', 'true');
        sessionStorage.setItem('ck_admin_pin', pinInput);
        setDbModalPin(pinInput);
        onShowToast('success', 'Đăng nhập trang Quản Trị thành công.');
      } else {
        setPinError(data.message || 'Mã PIN không đúng.');
      }
    } catch (err) {
      setPinError('Lỗi kết nối đến máy chủ.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('ck_admin_auth');
    sessionStorage.removeItem('ck_admin_pin');
  };

  // Download Database Backup (.db)
  const handleDownloadBackup = async () => {
    const pin = dbModalPin || sessionStorage.getItem('ck_admin_pin') || pinInput;
    if (!pin) {
      onShowToast('warning', 'Vui lòng nhập Mã PIN quản trị để tải bản sao lưu.');
      return;
    }
    setIsDownloadingBackup(true);
    try {
      const res = await fetch(`/api/admin/backup-db?pin=${encodeURIComponent(pin)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Lỗi khi tải bản sao lưu.');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition');
      let filename = `ck_reports_backup_${new Date().toLocaleDateString('en-CA')}.db`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      onShowToast('success', `Đã tải về bản sao lưu CSDL: ${filename}`);
    } catch (err) {
      onShowToast('error', err.message || 'Không thể tải bản sao lưu.');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  // Restore Database (.db)
  const handleRestoreDatabase = async (e) => {
    e.preventDefault();
    const pin = dbModalPin || sessionStorage.getItem('ck_admin_pin') || pinInput;
    if (!pin) {
      onShowToast('warning', 'Vui lòng nhập Mã PIN quản trị để khôi phục.');
      return;
    }
    if (!restoreFile) {
      onShowToast('warning', 'Vui lòng chọn file .db để khôi phục.');
      return;
    }

    const confirm = window.confirm(
      'CẢNH BÁO NGUY HIỂM:\nThao tác này sẽ ghi đè toàn bộ dữ liệu CSDL hiện tại trên server bằng file bạn chọn.\nBạn có chắc chắn muốn tiến hành khôi phục không?'
    );
    if (!confirm) return;

    setIsRestoring(true);
    try {
      const formData = new FormData();
      formData.append('db_file', restoreFile);
      formData.append('pin', pin);

      const res = await fetch('/api/admin/restore-db', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        onShowToast('success', data.message || 'Khôi phục cơ sở dữ liệu thành công!');
        setRestoreFile(null);
        setShowDbModal(false);
        // Reload all reports and stats
        await loadInitialData();
      } else {
        onShowToast('error', data.message || 'Lỗi khi khôi phục cơ sở dữ liệu.');
      }
    } catch (err) {
      onShowToast('error', 'Lỗi kết nối máy chủ khi khôi phục.');
    } finally {
      setIsRestoring(false);
    }
  };

  const fetchRegions = async () => {
    try {
      const res = await fetch('/api/regions');
      const data = await res.json();
      if (data.success) {
        setRegions(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching regions:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedRegion && selectedRegion !== 'all') params.append('region_id', selectedRegion);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setReports(result.data || []);
        setMeta(result.meta || { totalReports: 0, totalImages: 0 });
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      onShowToast('error', 'Không thể tải danh sách báo cáo.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Date Preset Handler
  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const formatDate = (d) => d.toLocaleDateString('en-CA');

    if (preset === 'today') {
      const todayStr = formatDate(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yStr = formatDate(yesterday);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === '7days') {
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      setStartDate(formatDate(past7));
      setEndDate(formatDate(today));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Export ZIP (Pattern B)
  const handleExportZip = () => {
    if (meta.totalImages === 0) {
      onShowToast('info', 'Không có hình ảnh nào trong bộ lọc hiện tại để xuất.');
      return;
    }

    setIsExporting(true);
    const params = new URLSearchParams();
    if (selectedRegion && selectedRegion !== 'all') params.append('region_id', selectedRegion);
    if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const downloadUrl = `/api/admin/export-zip?${params.toString()}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onShowToast('success', 'Đang nén và tải file ZIP về máy...');
    setTimeout(() => setIsExporting(false), 2000);
  };

  // Delete Report
  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lượt báo cáo này và tất cả hình ảnh liên quan?')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        onShowToast('success', 'Đã xóa báo cáo thành công.');
        fetchReports();
        fetchStats();
      } else {
        onShowToast('error', result.message || 'Lỗi khi xóa báo cáo.');
      }
    } catch (err) {
      onShowToast('error', 'Lỗi máy chủ khi xóa.');
    }
  };

  // Edit Region Name
  const handleSaveRegionName = async () => {
    if (!editRegionName.trim() || !editingRegion) return;
    setIsSavingRegion(true);

    try {
      const res = await fetch(`/api/admin/regions/${editingRegion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editRegionName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        onShowToast('success', 'Đã cập nhật tên khu vực!');
        setEditingRegion(null);
        setEditRegionName('');
        await fetchRegions();
        await fetchReports();
      } else {
        onShowToast('error', data.message || 'Lỗi khi cập nhật khu vực.');
      }
    } catch (err) {
      onShowToast('error', 'Lỗi kết nối máy chủ.');
    } finally {
      setIsSavingRegion(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleOpenLightbox = (image, reportImages) => {
    setActiveLightboxImg(image);
    setLightboxImagesList(reportImages);
  };

  // 1. PIN Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="container" style={{ maxWidth: '440px', marginTop: '3rem' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: 'var(--shadow-glow)'
            }}
          >
            <Lock size={30} />
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Khu Vực Quản Trị Viên
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
            Vui lòng nhập Mã PIN Quản Trị để truy cập báo cáo và xuất dữ liệu.
          </p>

          <form onSubmit={handleVerifyPin}>
            <div className="form-group">
              <input
                type="password"
                className="form-control"
                placeholder="Nhập mã PIN Quản Trị..."
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                autoComplete="off"
                style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px' }}
                autoFocus
                required
              />
            </div>

            {pinError && (
              <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {pinError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }}>
              <Unlock size={18} />
              <span>Mở Khóa Quản Trị</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Bảng Điều Khiển Quản Trị
            </h1>
            {stats?.cloudinary?.configured ? (
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.35rem 0.65rem', fontSize: '0.8rem', borderRadius: '100px' }}>
                ☁️ Cloudinary: {stats.cloudinary.cloudName} (Đã kết nối)
              </span>
            ) : (
              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.35rem 0.65rem', fontSize: '0.8rem', borderRadius: '100px' }}>
                📁 Lưu trữ: Cục bộ (Local Disk)
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Xem, lọc ảnh theo khu vực/nội dung/ngày và xuất file ZIP phân tầng chuẩn Mẫu B.
          </p>
        </div>

        <div className="admin-header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowRegionModal(true)}
            title="Đổi tên các khu vực 1 -> 22"
          >
            <Edit3 size={16} />
            <span>Quản Lý CSKV</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowDbModal(true)}
            title="Sao lưu hoặc khôi phục dữ liệu database SQLite (.db)"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Database size={16} color="var(--accent-cyan)" />
            <span>Sao Lưu / Khôi Phục DB</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={handleExportZip}
            disabled={isExporting || meta.totalImages === 0}
            title="Xuất ZIP theo Mẫu B: Khu_Vuc/Ngay/Ten_01.jpg"
          >
            {isExporting ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
            <span>Xuất File ZIP ({meta.totalImages} ảnh)</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleLogout}
            style={{ padding: '0.65rem 0.9rem' }}
            title="Đăng xuất"
          >
            <Lock size={15} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
              <Layers size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.totalReports}</div>
              <div className="stat-label">Tổng Lượt Báo Cáo</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
              <ImageIcon size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.totalImages}</div>
              <div className="stat-label">Tổng Ảnh Hệ Thống</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <Clock size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.reportsToday}</div>
              <div className="stat-label">Báo Cáo Hôm Nay</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <FileArchive size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{meta.totalImages}</div>
              <div className="stat-label">Ảnh Trong Bộ Lọc</div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Subtabs Navigation */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '0.75rem', 
          marginBottom: '1.75rem', 
          background: 'rgba(255, 255, 255, 0.04)', 
          padding: '0.4rem', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border-subtle)',
          width: 'fit-content',
          flexWrap: 'wrap'
        }}
      >
        <button
          type="button"
          className={`btn ${adminSubTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAdminSubTab('reports')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderRadius: 'var(--radius-md)',
            border: adminSubTab === 'reports' ? 'none' : '1px solid transparent'
          }}
        >
          <Layers size={18} />
          <span>Danh Sách Báo Cáo & Xuất ZIP</span>
        </button>

        <button
          type="button"
          className={`btn ${adminSubTab === 'ranking' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAdminSubTab('ranking')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderRadius: 'var(--radius-md)',
            border: adminSubTab === 'ranking' ? 'none' : '1px solid transparent',
            background: adminSubTab === 'ranking' ? 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)' : undefined,
            color: adminSubTab === 'ranking' ? '#ffffff' : undefined
          }}
        >
          <Trophy size={18} color={adminSubTab === 'ranking' ? '#fbbf24' : '#f59e0b'} />
          <span>Bảng Xếp Hạng CSKV</span>
          <span 
            style={{ 
              background: adminSubTab === 'ranking' ? 'rgba(251, 191, 36, 0.25)' : 'rgba(245, 158, 11, 0.15)', 
              color: adminSubTab === 'ranking' ? '#fef08a' : '#f59e0b', 
              fontSize: '0.72rem', 
              padding: '2px 8px', 
              borderRadius: '12px',
              fontWeight: 700
            }}
          >
            Thi Đua
          </span>
        </button>
      </div>

      {adminSubTab === 'ranking' ? (
        <CskvRankingPage onShowToast={onShowToast} isAdminView={true} />
      ) : (
        <>
          {/* Clean, Non-overlapping Filter Section */}
          <div className="glass-card" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
            {/* Row 1: Dropdown filters (Khu Vực & Nội Dung Góp Ý) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              {/* Region Filter */}
              <div>
            <label className="form-label">
              <MapPin size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Lọc theo CSKV
            </label>
            <select
              className="form-control"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
            >
              <option value="all">Tất cả cảnh sát khu vực ({regions.length})</option>
              {regions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name}
                </option>
              ))}
            </select>
          </div>

          {/* Feedback Category Filter */}
          <div>
            <label className="form-label">
              <Tag size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Lọc theo Mục Nội Dung Góp Ý
            </label>
            <select
              className="form-control"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">Tất cả mục góp ý</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Date Filters with distinct, wide fields that NEVER overlap */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'flex-end' }}>
          
          {/* Quick Date Presets */}
          <div>
            <label className="form-label">
              <Calendar size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Mốc Thời Gian Nhanh
            </label>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-secondary ${datePreset === 'today' ? 'active' : ''}`}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', background: datePreset === 'today' ? 'var(--primary)' : undefined }}
                onClick={() => handleDatePreset('today')}
              >
                Hôm nay
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${datePreset === 'yesterday' ? 'active' : ''}`}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', background: datePreset === 'yesterday' ? 'var(--primary)' : undefined }}
                onClick={() => handleDatePreset('yesterday')}
              >
                Hôm qua
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${datePreset === '7days' ? 'active' : ''}`}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', background: datePreset === '7days' ? 'var(--primary)' : undefined }}
                onClick={() => handleDatePreset('7days')}
              >
                7 ngày qua
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${datePreset === 'all' ? 'active' : ''}`}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', background: datePreset === 'all' ? 'var(--primary)' : undefined }}
                onClick={() => handleDatePreset('all')}
              >
                Tất cả
              </button>
            </div>
          </div>

          {/* Start Date - Dedicated column */}
          <div>
            <label className="form-label">
              Từ Ngày
            </label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
            />
          </div>

          {/* End Date - Dedicated column */}
          <div>
            <label className="form-label">
              Đến Ngày
            </label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
            />
          </div>

          {/* Refresh Action */}
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.75rem' }}
              onClick={fetchReports}
              title="Làm mới danh sách"
            >
              <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
              <span>Làm Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reports Feed */}
      <div id="reports-feed">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            Danh Sách Báo Cáo ({meta.totalReports} lượt gửi / {meta.totalImages} ảnh)
          </h2>
          {loading && <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>Đang tải dữ liệu...</span>}
        </div>

        {/* Top Pagination Bar */}
        {totalReportsCount > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>
                  Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong> (Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalReportsCount)}</strong> / {totalReportsCount} lượt gửi)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mỗi trang:</span>
                  <select
                    className="form-control"
                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.8rem', width: 'auto', fontWeight: 600 }}
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>10 báo cáo</option>
                    <option value={20}>20 báo cáo</option>
                    <option value={50}>50 báo cáo</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage(1);
                      document.getElementById('reports-feed')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    title="Trang đầu"
                  >
                    <ChevronsLeft size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      document.getElementById('reports-feed')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    title="Trang trước"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span style={{ fontSize: '0.82rem', fontWeight: 700, padding: '0 0.4rem', color: 'var(--text-primary)' }}>
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      document.getElementById('reports-feed')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    title="Trang sau"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage(totalPages);
                      document.getElementById('reports-feed')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    title="Trang cuối"
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {reports.length === 0 && !loading ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              <Layers size={42} strokeWidth={1.5} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Không tìm thấy báo cáo nào
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Hãy thử chọn ngày khác hoặc đổi điều kiện lọc khu vực / mục góp ý ở trên.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {paginatedReports.map((report) => (
              <div key={report.id} className="glass-card" style={{ padding: '1.25rem' }}>
                {/* Report Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <MapPin size={18} style={{ color: 'var(--accent-cyan)' }} />
                        {report.region_name}
                      </span>
                      {report.category && (
                        <span className="badge badge-primary">{report.category}</span>
                      )}
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                        {report.report_date}
                      </span>
                      <span className="badge badge-emerald" style={{ fontSize: '0.78rem' }}>
                        📷 {report.image_count || report.images?.length || 1} ảnh đã gửi
                      </span>
                    </div>

                    {report.note && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem', lineHeight: '1.5' }}>
                        💬 {report.note}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Gửi lúc: {formatReportTime(report.created_at)}
                    </span>

                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem' }}
                      onClick={() => handleDeleteReport(report.id)}
                      title="Xóa lượt báo cáo này"
                    >
                      <Trash2 size={14} />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>

                {/* Images Attachment */}
                {report.images && report.images.length > 0 && (
                  <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    {report.images.map((img, idx) => (
                      <button
                        key={img.id}
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.825rem',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => handleOpenLightbox(img, report.images)}
                        title="Bấm để xem ảnh chi tiết và tải về"
                      >
                        <ImageIcon size={15} style={{ color: 'var(--accent-cyan)' }} />
                        <span style={{ fontWeight: 500 }}>
                          Xem ảnh {report.images.length > 1 ? `#${idx + 1}` : ''}
                        </span>
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            padding: '0.15rem 0.4rem', 
                            borderRadius: '4px', 
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-muted)'
                          }}
                        >
                          {formatFileSize(img.file_size)}
                        </span>
                        <Eye size={14} style={{ color: 'var(--accent-emerald)', marginLeft: '2px' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Bottom Pagination Bar */}
            {totalPages > 1 && (
              <div 
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-sm)',
                  marginTop: '0.5rem'
                }}
              >
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Đang xem trang <strong>{currentPage}</strong> trên <strong>{totalPages}</strong> (Tổng <strong>{totalReportsCount}</strong> lượt gửi)
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage(1);
                      document.getElementById('reports-feed')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronsLeft size={15} />
                    <span>Đầu</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      document.getElementById('reports-feed')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronLeft size={15} />
                    <span>Trước</span>
                  </button>

                  <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0 0.5rem', color: 'var(--cand-red)' }}>
                    Trang {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      document.getElementById('reports-feed')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <span>Sau</span>
                    <ChevronRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage(totalPages);
                      document.getElementById('reports-feed')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <span>Cuối</span>
                    <ChevronsRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {/* Region Management Modal */}
      {showRegionModal && (
        <div className="modal-overlay" onClick={() => setShowRegionModal(false)}>
          <div className="modal-box" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Đổi tên CSKV nếu có điều chỉnh công tác</h3>
              <button className="modal-close-btn" onClick={() => setShowRegionModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Bấm nút <strong>Sửa</strong> bên cạnh bất kỳ khu vực nào để cập nhật tên thực tế (ví dụ: đổi thành "Xưởng A - Dây Chuyền 1").
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {regions.map((reg) => (
                  <div
                    key={reg.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    {editingRegion?.id === reg.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <input
                          type="text"
                          className="form-control"
                          value={editRegionName}
                          onChange={(e) => setEditRegionName(e.target.value)}
                          placeholder="Nhập tên mới..."
                          autoFocus
                          style={{ padding: '0.45rem 0.75rem', fontSize: '0.875rem' }}
                        />
                        <button
                          className="btn btn-success"
                          style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={handleSaveRegionName}
                          disabled={isSavingRegion}
                        >
                          <Check size={15} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => { setEditingRegion(null); setEditRegionName(''); }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{reg.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                            ({reg.code})
                          </span>
                        </div>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            setEditingRegion(reg);
                            setEditRegionName(reg.name);
                          }}
                        >
                          <Edit3 size={13} />
                          <span>Đổi tên</span>
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowRegionModal(false)}>
                Hoàn Tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Backup & Restore Modal */}
      {showDbModal && (
        <div className="modal-overlay" onClick={() => !isRestoring && setShowDbModal(false)}>
          <div className="modal-box" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Database size={20} color="var(--accent-cyan)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Sao Lưu & Khôi Phục Cơ Sở Dữ Liệu</h3>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => !isRestoring && setShowDbModal(false)}
                disabled={isRestoring}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* PIN input if not already saved in session */}
              {!sessionStorage.getItem('ck_admin_pin') && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                    Xác thực Mã PIN Quản Trị:
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Nhập mã PIN quản trị..."
                    value={dbModalPin}
                    onChange={(e) => setDbModalPin(e.target.value)}
                  />
                </div>
              )}

              {/* Section 1: Backup */}
              <div style={{ padding: '1.1rem', background: 'rgba(6, 182, 212, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Download size={18} color="var(--accent-cyan)" />
                  <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>1. Sao Lưu (Tải file .db về máy tính)</strong>
                </div>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 0.85rem 0' }}>
                  Tải toàn bộ dữ liệu hiện tại (báo cáo, danh sách CSKV, lịch sử) về máy tính cá nhân. 
                  <br />
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>💡 Mẹo quan trọng:</span> Hãy bấm tải về <strong>trước mỗi lần deploy commit mới</strong> để không bao giờ bị mất dữ liệu khi server tạo container mới.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDownloadBackup}
                  disabled={isDownloadingBackup}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1rem', fontSize: '0.875rem' }}
                >
                  {isDownloadingBackup ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={15} />}
                  <span>{isDownloadingBackup ? 'Đang tạo bản sao lưu...' : 'Tải File CSDL Về Máy (.db)'}</span>
                </button>
              </div>

              {/* Section 2: Restore */}
              <div style={{ padding: '1.1rem', background: 'rgba(245, 158, 11, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <UploadCloud size={18} color="#f59e0b" />
                  <strong style={{ color: '#f59e0b', fontSize: '0.95rem' }}>2. Khôi Phục (Tải file .db đã lưu lên hệ thống)</strong>
                </div>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 0.85rem 0' }}>
                  Sau khi deploy code mới lên server (nếu dữ liệu bị trắng), bạn chọn file <code>.db</code> đã sao lưu ở bước 1 để phục hồi lại toàn bộ dữ liệu trước đó ngay tức thì.
                </p>

                <div style={{ marginBottom: '0.85rem' }}>
                  <input
                    type="file"
                    accept=".db,.sqlite,.sqlite3"
                    id="db-restore-file-input"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setRestoreFile(e.target.files[0]);
                      }
                    }}
                  />
                  <label
                    htmlFor="db-restore-file-input"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.85rem 1rem',
                      border: '2px dashed rgba(255, 255, 255, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.02)',
                      fontSize: '0.85rem',
                      color: restoreFile ? 'var(--accent-emerald)' : 'var(--text-muted)'
                    }}
                  >
                    <FileArchive size={18} />
                    <span>
                      {restoreFile 
                        ? `Đã chọn: ${restoreFile.name} (${(restoreFile.size / 1024).toFixed(0)} KB)` 
                        : 'Nhấp vào đây để chọn file sao lưu (.db)'}
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRestoreDatabase}
                  disabled={!restoreFile || isRestoring}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    padding: '0.55rem 1rem', 
                    fontSize: '0.875rem',
                    background: !restoreFile ? undefined : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                  }}
                >
                  {isRestoring ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <UploadCloud size={15} />}
                  <span>{isRestoring ? 'Đang khôi phục dữ liệu...' : 'Bắt Đầu Khôi Phục Dữ Liệu'}</span>
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => !isRestoring && setShowDbModal(false)}
                disabled={isRestoring}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightboxImg && (
        <Lightbox
          image={activeLightboxImg}
          images={lightboxImagesList}
          onClose={() => setActiveLightboxImg(null)}
          onSelectImage={(newImg) => setActiveLightboxImg(newImg)}
        />
      )}
    </div>
  );
}
