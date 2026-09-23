import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Medal, 
  Award, 
  Calendar, 
  Filter, 
  TrendingUp, 
  Users, 
  Image as ImageIcon, 
  Search, 
  RefreshCw, 
  Send, 
  Sparkles, 
  Flame,
  Clock,
  CheckCircle2,
  ChevronRight,
  Copy,
  Check,
  FileText
} from 'lucide-react';

export default function CskvRankingPage({ onShowToast, onNavigateUpload, isAdminView = false }) {
  // Current time helpers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const prevMonthStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }, []);

  // Filter State: Default to 'day' (Hôm nay) or 'month' (Tháng này)
  const [timeRange, setTimeRange] = useState('day'); // 'day' | 'month' | 'all'
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Data State
  const [rankings, setRankings] = useState([]);
  const [meta, setMeta] = useState({ totalReports: 0, totalImages: 0, totalRegions: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch rankings from API
  const fetchRankings = async () => {
    try {
      setLoading(true);
      let queryParams = new URLSearchParams({ timeRange });

      if (timeRange === 'day') {
        queryParams.set('date', selectedDate);
      } else if (timeRange === 'month') {
        queryParams.set('month', selectedMonth);
      }

      const res = await fetch(`/api/admin/cskv-rankings?${queryParams.toString()}`);
      const result = await res.json();

      if (result.success && Array.isArray(result.data)) {
        setRankings(result.data);
        setMeta(result.meta || { totalReports: 0, totalImages: 0, totalRegions: result.data.length });
      } else {
        if (onShowToast) onShowToast('error', result.message || 'Không thể tải bảng xếp hạng.');
      }
    } catch (err) {
      console.error('Lỗi khi tải xếp hạng CSKV:', err);
      if (onShowToast) onShowToast('error', 'Lỗi kết nối máy chủ khi lấy dữ liệu xếp hạng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [timeRange, selectedDate, selectedMonth]);

  // Filtered and sorted rankings:
  // Mặc định sắp xếp theo những người làm nhiều nhất đến những người thấp nhất (b.report_count - a.report_count)
  const processedRankings = useMemo(() => {
    let list = [...rankings];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((r) => 
        (r.region_name && r.region_name.toLowerCase().includes(q)) ||
        (r.region_code && r.region_code.toLowerCase().includes(q))
      );
    }

    // Mặc định luôn xếp hạng khu vực theo số lượng góp ý từ cao đến thấp
    list.sort((a, b) => {
      if (b.report_count !== a.report_count) {
        return b.report_count - a.report_count;
      }
      if (b.image_count !== a.image_count) {
        return b.image_count - a.image_count;
      }
      return (a.display_order || 0) - (b.display_order || 0);
    });

    return list;
  }, [rankings, searchTerm]);

  // Top 3 Podium (Chỉ hiển thị khi có khu vực có số báo cáo > 0)
  const activeReportsList = useMemo(() => {
    return rankings.filter((r) => r.report_count > 0);
  }, [rankings]);

  const top1 = activeReportsList.length > 0 ? activeReportsList[0] : null;
  const top2 = activeReportsList.length > 1 ? activeReportsList[1] : null;
  const top3 = activeReportsList.length > 2 ? activeReportsList[2] : null;

  // Format date range label for UI
  const getTimeRangeLabel = () => {
    if (timeRange === 'day') {
      const [y, m, d] = selectedDate.split('-');
      const isToday = selectedDate === todayStr;
      const isYesterday = selectedDate === yesterdayStr;
      const prefix = isToday ? 'Hôm nay - ' : isYesterday ? 'Hôm qua - ' : '';
      return `${prefix}Ngày ${d}/${m}/${y}`;
    }
    if (timeRange === 'month') {
      const [y, m] = selectedMonth.split('-');
      const isCurrentMonth = selectedMonth === currentMonthStr;
      const prefix = isCurrentMonth ? 'Tháng này - ' : '';
      return `${prefix}Tháng ${m}/${y}`;
    }
    return 'Toàn bộ thời gian';
  };

  // Copy Briefing Summary for Police Meeting / Zalo Group
  const handleCopySummary = () => {
    const timeLabel = getTimeRangeLabel();
    let text = `📋 BÁO CÁO THI ĐUA CSKV - ${timeLabel.toUpperCase()}\n`;
    text += `Đơn vị: Công An Phường Cầu Kiệu\n`;
    text += `Tổng số báo cáo hoàn thành: ${meta.totalReports} lượt (${meta.totalImages} ảnh minh chứng)\n`;
    text += `------------------------------------\n`;

    if (activeReportsList.length === 0) {
      text += `Chưa có đơn vị nào phát sinh báo cáo trong thời gian này.\n`;
    } else {
      activeReportsList.forEach((r, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        text += `${medal} ${r.region_name}: ${r.report_count} Trường hợp \n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (onShowToast) onShowToast('success', 'Đã sao chép nội dung tóm tắt báo cáo vào bộ nhớ tạm!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="container" style={{ maxWidth: '1100px' }}>
      {/* Header Banner */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #991b1b 0%, #b91c1c 45%, #7f1d1d 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem 1.75rem',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(153, 27, 27, 0.25)',
          marginBottom: '1.75rem',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(251, 191, 36, 0.35)'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <span 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(251, 191, 36, 0.2)',
                color: '#fef08a',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: '1px solid rgba(251, 191, 36, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              <Trophy size={14} color="#fef08a" />
              Thi Đua Cơ Sở
            </span>
            <span style={{ fontSize: '0.85rem', color: '#fef3c7', opacity: 0.9 }}>
              Xếp hạng theo số lượt thực hiện & nộp ảnh minh chứng
            </span>
          </div>

          <h1 
            style={{ 
              fontSize: '1.85rem', 
              fontWeight: 800, 
              letterSpacing: '0.01em', 
              color: '#ffffff',
              marginBottom: '0.4rem',
              lineHeight: 1.25
            }}
          >
            BẢNG XẾP HẠNG CẢNH SÁT KHU VỰC (CSKV)
          </h1>
          <p style={{ color: '#fef2f2', fontSize: '0.925rem', maxWidth: '750px', lineHeight: 1.5, opacity: 0.95 }}>
            Mỗi báo cáo được tính hợp lệ khi người dùng điền đầy đủ thông tin kèm hình ảnh minh chứng thực hiện. 
            Hệ thống tự động sắp xếp theo thứ tự khu vực làm nhiều nhất đến thấp nhất theo ngày và theo tháng.
          </p>
        </div>

        {/* Decorative background glow */}
        <div 
          style={{
            position: 'absolute',
            right: '-40px',
            top: '-40px',
            width: '240px',
            height: '240px',
            background: 'radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* Primary Mode Switcher (Theo Ngày / Theo Tháng) */}
      <div 
        className="glass-card" 
        style={{ 
          marginBottom: '1.75rem', 
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Tiêu Chí Xếp Hạng Thời Gian
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn ${timeRange === 'day' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.1rem', fontWeight: 700 }}
                onClick={() => setTimeRange('day')}
              >
                <Calendar size={16} />
                <span>Theo Ngày</span>
              </button>

              <button
                type="button"
                className={`btn ${timeRange === 'month' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.1rem', fontWeight: 700 }}
                onClick={() => setTimeRange('month')}
              >
                <Clock size={16} />
                <span>Theo Tháng</span>
              </button>

              <button
                type="button"
                className={`btn ${timeRange === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                onClick={() => setTimeRange('all')}
              >
                <TrendingUp size={16} />
                <span>Tất Cả</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons & Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {timeRange === 'day' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn ${selectedDate === todayStr ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => setSelectedDate(todayStr)}
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  className={`btn ${selectedDate === yesterdayStr ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => setSelectedDate(yesterdayStr)}
                >
                  Hôm qua
                </button>
                <input
                  type="date"
                  className="form-control"
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', width: 'auto' }}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  title="Chọn ngày cụ thể"
                />
              </div>
            )}

            {timeRange === 'month' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn ${selectedMonth === currentMonthStr ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => setSelectedMonth(currentMonthStr)}
                >
                  Tháng này
                </button>
                <button
                  type="button"
                  className={`btn ${selectedMonth === prevMonthStr ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => setSelectedMonth(prevMonthStr)}
                >
                  Tháng trước
                </button>
                <input
                  type="month"
                  className="form-control"
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', width: 'auto' }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  title="Chọn tháng cụ thể"
                />
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
              onClick={fetchRankings}
              title="Làm mới dữ liệu xếp hạng"
            >
              <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
              <span>Làm Mới</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem', borderColor: 'rgba(251, 191, 36, 0.4)' }}
              onClick={handleCopySummary}
              title="Sao chép tóm tắt xếp hạng để gửi Zalo / Báo cáo giao ban"
            >
              {copied ? <Check size={15} color="var(--accent-emerald)" /> : <Copy size={15} />}
              <span>{copied ? 'Đã Sao Chép!' : 'Sao Chép Báo Cáo'}</span>
            </button>
          </div>
        </div>

        {/* Search Control */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
            <Search 
              size={15} 
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
            />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2rem', fontSize: '0.85rem' }}
              placeholder="Tìm theo tên CSKV..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        {/* Total Reports */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Tổng Báo Cáo ({getTimeRangeLabel()})
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--cand-red)', marginTop: '0.25rem' }}>
                {meta.totalReports.toLocaleString('vi-VN')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Đầy đủ thông tin & ảnh đính kèm
              </div>
            </div>
            <div 
              style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: 'var(--radius-md)', 
                background: 'rgba(185, 28, 28, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--cand-red)' 
              }}
            >
              <Send size={20} />
            </div>
          </div>
        </div>

        {/* Total Images */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Tổng Ảnh Minh Chứng
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '0.25rem' }}>
                {meta.totalImages.toLocaleString('vi-VN')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Hình ảnh thực hiện nhiệm vụ
              </div>
            </div>
            <div 
              style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: 'var(--radius-md)', 
                background: 'rgba(21, 128, 61, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--accent-emerald)' 
              }}
            >
              <ImageIcon size={20} />
            </div>
          </div>
        </div>

        {/* Top Leader */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Khu Vực Dẫn Đầu ({getTimeRangeLabel()})
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: top1 ? 'var(--cand-gold)' : 'var(--text-muted)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Trophy size={18} />
                <span>{top1 ? top1.region_name : 'Chưa có báo cáo'}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                {top1 ? `${top1.report_count} báo cáo (${top1.percentage}% toàn phường)` : 'Chờ lượt báo cáo đầu tiên'}
              </div>
            </div>
            <div 
              style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: 'var(--radius-md)', 
                background: 'rgba(217, 119, 6, 0.12)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--cand-gold)' 
              }}
            >
              <Sparkles size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium (Only when there are completed reports) */}
      {top1 && (
        <div 
          className="glass-card" 
          style={{ 
            marginBottom: '2rem', 
            padding: '2rem 1.5rem',
            textAlign: 'center'
          }}
        >
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Medal size={20} color="var(--cand-gold)" />
              BỤC VINH DANH CSKV XUẤT SẮC ({getTimeRangeLabel()})
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Top các khu vực hoàn thành nhiều báo cáo và hình ảnh minh chứng nhất
            </p>
          </div>

          <div 
            className="podium-container"
            style={{ 
              display: 'flex', 
              alignItems: 'flex-end', 
              justifyContent: 'center', 
              gap: '1rem',
              maxWidth: '700px',
              margin: '0 auto',
              paddingTop: '1rem'
            }}
          >
            {/* Rank 2 (Silver) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {top2 ? (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🥈</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {top2.region_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--cand-red)' }}>{top2.report_count}</strong> báo cáo ({top2.image_count} ảnh)
                  </div>
                  <div 
                    style={{
                      width: '100%',
                      height: '110px',
                      background: 'linear-gradient(180deg, #94a3b8 0%, #cbd5e1 100%)',
                      borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '1.5rem',
                      boxShadow: '0 4px 12px rgba(148, 163, 184, 0.3)'
                    }}
                  >
                    #2
                  </div>
                </>
              ) : (
                <div style={{ height: '110px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Chưa có #2
                </div>
              )}
            </div>

            {/* Rank 1 (Gold - Center & Highest) */}
            <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>🥇</div>
              <div 
                style={{ 
                  fontWeight: 800, 
                  fontSize: '1.1rem', 
                  color: 'var(--cand-red)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.35rem' 
                }}
              >
                <span>{top1.region_name}</span>
                <Flame size={18} color="var(--cand-gold)" />
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <strong style={{ color: 'var(--cand-red)', fontSize: '1rem' }}>{top1.report_count}</strong> báo cáo ({top1.image_count} ảnh)
              </div>
              <div 
                style={{
                  width: '100%',
                  height: '150px',
                  background: 'linear-gradient(180deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)',
                  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '2rem',
                  boxShadow: '0 6px 20px rgba(217, 119, 6, 0.4)',
                  border: '2px solid rgba(255, 255, 255, 0.6)'
                }}
              >
                <div>#1</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dẫn Đầu
                </div>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {top3 ? (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🥉</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {top3.region_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--cand-red)' }}>{top3.report_count}</strong> báo cáo ({top3.image_count} ảnh)
                  </div>
                  <div 
                    style={{
                      width: '100%',
                      height: '80px',
                      background: 'linear-gradient(180deg, #b45309 0%, #d97706 100%)',
                      borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '1.35rem',
                      boxShadow: '0 4px 10px rgba(180, 83, 9, 0.25)'
                    }}
                  >
                    #3
                  </div>
                </>
              ) : (
                <div style={{ height: '80px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Chưa có #3
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Chi Tiết Xếp Hạng 22 CSKV (Từ Cao Đến Thấp)
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Hiển thị {processedRankings.length} khu vực • Thời gian: {getTimeRangeLabel()}
            </span>
          </div>

          {onNavigateUpload && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
              onClick={onNavigateUpload}
            >
              <Send size={14} />
              <span>Gửi Báo Cáo Kèm Ảnh</span>
            </button>
          )}
        </div>

        {/* Empty State when no reports yet */}
        {!loading && meta.totalReports === 0 && (
          <div 
            style={{ 
              textAlign: 'center', 
              padding: '2.5rem 1.5rem', 
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-subtle)',
              marginBottom: '1.5rem'
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📢</div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Chưa có báo cáo nào được ghi nhận trong {getTimeRangeLabel()}
            </h3>
            {onNavigateUpload && (
              <button
                type="button"
                className="btn btn-gold"
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}
                onClick={onNavigateUpload}
              >
                <span>+ Gửi Báo Cáo Thực Hiện Đầu Tiên</span>
              </button>
            )}
          </div>
        )}

        {/* Table / List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin-animation" style={{ margin: '0 auto 0.75rem' }} />
            <div>Đang tải dữ liệu xếp hạng CSKV...</div>
          </div>
        ) : (
          <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '600px' }}>
              <thead>
                <tr 
                  style={{ 
                    borderBottom: '2px solid var(--border-subtle)', 
                    textAlign: 'left',
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  <th style={{ padding: '0.75rem 0.5rem', width: '60px', textAlign: 'center' }}>Hạng</th>
                  <th style={{ padding: '0.75rem 0.75rem' }}>Khu Vực CSKV</th>
                  <th style={{ padding: '0.75rem 0.75rem', minWidth: '180px' }}>Số Báo Cáo Hoàn Thành</th>
                  <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', width: '110px' }}>Ảnh Minh Chứng</th>
                  <th style={{ padding: '0.75rem 0.75rem' }}>Nội Dung Thực Hiện</th>
                  <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', width: '130px' }}>Đánh Giá Thi Đua</th>
                </tr>
              </thead>
              <tbody>
                {processedRankings.map((item, index) => {
                  const hasReports = item.report_count > 0;
                  const rankNum = index + 1;
                  const isTop1 = hasReports && rankNum === 1;
                  const isTop2 = hasReports && rankNum === 2;
                  const isTop3 = hasReports && rankNum === 3;

                  // Categories breakdown array
                  const catEntries = Object.entries(item.categories || {});

                  return (
                    <tr 
                      key={item.region_id}
                      style={{ 
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isTop1 
                          ? 'rgba(217, 119, 6, 0.06)' 
                          : isTop2 
                          ? 'rgba(148, 163, 184, 0.05)' 
                          : isTop3 
                          ? 'rgba(180, 83, 9, 0.04)' 
                          : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      {/* Rank Column */}
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                        {isTop1 ? (
                          <span style={{ fontSize: '1.35rem' }} title="Hạng 1 - Dẫn đầu">🥇</span>
                        ) : isTop2 ? (
                          <span style={{ fontSize: '1.35rem' }} title="Hạng 2 - Xuất sắc">🥈</span>
                        ) : isTop3 ? (
                          <span style={{ fontSize: '1.35rem' }} title="Hạng 3">🥉</span>
                        ) : hasReports ? (
                          <span 
                            style={{ 
                              display: 'inline-block',
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-primary)',
                              fontWeight: 700,
                              lineHeight: '26px',
                              fontSize: '0.8rem'
                            }}
                          >
                            {rankNum}
                          </span>
                        ) : (
                          <span 
                            style={{ 
                              display: 'inline-block',
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: 'var(--bg-main)',
                              color: 'var(--text-muted)',
                              lineHeight: '26px',
                              fontSize: '0.75rem'
                            }}
                            title="Chưa có báo cáo"
                          >
                            -
                          </span>
                        )}
                      </td>

                      {/* Region Name */}
                      <td style={{ padding: '0.85rem 0.75rem' }}>
                        <div style={{ fontWeight: 700, color: isTop1 ? 'var(--cand-gold)' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {item.region_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Mã: {item.region_code}
                        </div>
                      </td>

                      {/* Completed Reports Count & Progress Bar */}
                      <td style={{ padding: '0.85rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: hasReports ? 'var(--cand-red)' : 'var(--text-muted)' }}>
                            {item.report_count}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            báo cáo {meta.totalReports > 0 && `(${item.percentage}%)`}
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div 
                          style={{ 
                            height: '6px', 
                            background: 'var(--border-subtle)', 
                            borderRadius: '3px', 
                            overflow: 'hidden',
                            maxWidth: '180px'
                          }}
                        >
                          <div 
                            style={{ 
                              height: '100%', 
                              width: `${Math.max(item.percentage, hasReports ? 8 : 0)}%`,
                              background: isTop1 
                                ? 'linear-gradient(90deg, #d97706, #f59e0b)' 
                                : 'linear-gradient(90deg, #b91c1c, #dc2626)',
                              borderRadius: '3px',
                              transition: 'width 0.4s ease'
                            }}
                          />
                        </div>
                      </td>

                      {/* Image Count */}
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        <span 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            background: item.image_count > 0 ? 'rgba(21, 128, 61, 0.12)' : 'var(--bg-main)',
                            color: item.image_count > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: '0.85rem'
                          }}
                        >
                          <ImageIcon size={13} />
                          {item.image_count}
                        </span>
                      </td>

                      {/* Category Breakdown Chips */}
                      <td style={{ padding: '0.85rem 0.75rem' }}>
                        {catEntries.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {catEntries.map(([catName, count]) => (
                              <span
                                key={catName}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--bg-main)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                {catName}: <strong>{count}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Chưa có dữ liệu
                          </span>
                        )}
                      </td>

                      {/* Performance Status Badge */}
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                        {isTop1 ? (
                          <span 
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(217, 119, 6, 0.15)',
                              color: '#b45309',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                          >
                            🏆 Dẫn đầu
                          </span>
                        ) : isTop2 || isTop3 ? (
                          <span 
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(21, 128, 61, 0.12)',
                              color: 'var(--accent-emerald)',
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                          >
                            Xuất sắc
                          </span>
                        ) : hasReports ? (
                          <span 
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(2, 132, 199, 0.1)',
                              color: 'var(--accent-cyan)',
                              fontWeight: 600,
                              fontSize: '0.75rem'
                            }}
                          >
                            Tích cực
                          </span>
                        ) : (
                          <span 
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--bg-main)',
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem'
                            }}
                          >
                            Chờ thực hiện
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
