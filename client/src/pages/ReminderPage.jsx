import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Calendar,
  Clock,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Send,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const DAILY_QUOTA = 15;

// Helper functions for ISO week calculation
const getIsoWeek = (d = new Date()) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

const parseWeekRange = (weekStr) => {
  if (!weekStr || !weekStr.includes('-W')) {
    return parseWeekRange(getIsoWeek(new Date()));
  }
  const parts = weekStr.split('-W');
  const year = parseInt(parts[0], 10);
  const w = parseInt(parts[1], 10);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monW1 = new Date(year, 0, 4 - (jan4Day - 1));
  const mon = new Date(monW1.getFullYear(), monW1.getMonth(), monW1.getDate() + (w - 1) * 7);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);

  const toYmd = (d) =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');

  const startDisplay =
    mon.getFullYear() !== sun.getFullYear()
      ? `${String(mon.getDate()).padStart(2, '0')}/${String(mon.getMonth() + 1).padStart(2, '0')}/${mon.getFullYear()}`
      : `${String(mon.getDate()).padStart(2, '0')}/${String(mon.getMonth() + 1).padStart(2, '0')}`;
  const endDisplay = `${String(sun.getDate()).padStart(2, '0')}/${String(sun.getMonth() + 1).padStart(2, '0')}/${sun.getFullYear()}`;

  return {
    startDate: toYmd(mon),
    endDate: toYmd(sun),
    startDisplay,
    endDisplay,
    weekNumber: w
  };
};

const formatYmdToVi = (ymd) => {
  if (!ymd || !ymd.includes('-')) return ymd || '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
};

export default function ReminderPage({ onShowToast, onNavigateUpload }) {
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  }, []);

  const currentWeekStr = useMemo(() => getIsoWeek(new Date()), []);
  const prevWeekStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getIsoWeek(d);
  }, []);

  const currentMonthStr = useMemo(() => new Date().toLocaleDateString('en-CA').slice(0, 7), []);
  const prevMonthStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString('en-CA').slice(0, 7);
  }, []);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const prevYear = useMemo(() => currentYear - 1, [currentYear]);

  // Filter state
  const [timeRange, setTimeRange] = useState('day'); // 'day' | 'week' | 'month' | 'year'
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [quotaStartDate, setQuotaStartDate] = useState(`${todayStr.slice(0, 7)}-01`);
  const [selectedWeek, setSelectedWeek] = useState(currentWeekStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [searchTerm, setSearchTerm] = useState('');

  // Data state
  const [reminders, setReminders] = useState([]);
  const [meta, setMeta] = useState({
    dailyQuota: DAILY_QUOTA,
    periodStart: todayStr,
    periodEnd: todayStr,
    daysCount: 1,
    totalRegions: 0,
    completedCount: 0,
    incompleteCount: 0,
    totalMissing: 0
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expandedRegionId, setExpandedRegionId] = useState(null);
  const [onlyShortDays, setOnlyShortDays] = useState(true);

  // Sync default quotaStartDate to start of selectedDate's month if user picks a different month in 'day' mode
  const handleSelectedDateChange = (newDate) => {
    setSelectedDate(newDate);
    if (newDate && quotaStartDate > newDate) {
      setQuotaStartDate(`${newDate.slice(0, 7)}-01`);
    }
  };

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        timeRange,
        dailyQuota: String(DAILY_QUOTA)
      });

      if (timeRange === 'day') {
        queryParams.set('date', selectedDate);
        if (quotaStartDate) {
          queryParams.set('quotaStartDate', quotaStartDate);
        }
      } else if (timeRange === 'week') {
        const range = parseWeekRange(selectedWeek);
        queryParams.set('startDate', range.startDate);
        queryParams.set('endDate', range.endDate);
        queryParams.set('week', selectedWeek);
      } else if (timeRange === 'month') {
        queryParams.set('month', selectedMonth);
      } else if (timeRange === 'year') {
        queryParams.set('year', selectedYear);
      }

      const res = await fetch(`/api/cskv-reminders?${queryParams.toString()}`);
      const result = await res.json();

      if (result.success && Array.isArray(result.data)) {
        setReminders(result.data);
        setMeta(result.meta || {});
      } else if (onShowToast) {
        onShowToast('error', result.message || 'Không thể tải danh sách nhắc nhở.');
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách nhắc nhở:', err);
      if (onShowToast) onShowToast('error', 'Lỗi kết nối máy chủ khi tải danh sách nhắc nhở.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [timeRange, selectedDate, quotaStartDate, selectedWeek, selectedMonth, selectedYear]);

  const filteredReminders = useMemo(() => {
    if (!searchTerm.trim()) return reminders;
    const q = searchTerm.trim().toLowerCase();
    return reminders.filter(
      (r) =>
        (r.region_name && r.region_name.toLowerCase().includes(q)) ||
        (r.region_code && r.region_code.toLowerCase().includes(q))
    );
  }, [reminders, searchTerm]);

  const getTimeRangeLabel = () => {
    if (timeRange === 'day') {
      const isToday = selectedDate === todayStr;
      const isYesterday = selectedDate === yesterdayStr;
      const prefix = isToday ? 'Hôm nay - ' : isYesterday ? 'Hôm qua - ' : '';
      return `${prefix}Ngày ${formatYmdToVi(selectedDate)}`;
    }
    if (timeRange === 'week') {
      const range = parseWeekRange(selectedWeek);
      const isCurrentWeek = selectedWeek === currentWeekStr;
      const isPrevWeek = selectedWeek === prevWeekStr;
      const prefix = isCurrentWeek ? 'Tuần này - ' : isPrevWeek ? 'Tuần trước - ' : '';
      return `${prefix}Tuần ${range.weekNumber} (${range.startDisplay} - ${range.endDisplay})`;
    }
    if (timeRange === 'month') {
      const [y, m] = selectedMonth.split('-');
      const isCurrentMonth = selectedMonth === currentMonthStr;
      const prefix = isCurrentMonth ? 'Tháng này - ' : '';
      return `${prefix}Tháng ${m}/${y}`;
    }
    if (timeRange === 'year') {
      return selectedYear === String(currentYear)
        ? `Năm nay - Năm ${selectedYear}`
        : `Năm ${selectedYear}`;
    }
    return '';
  };

  const handleCopyReminder = () => {
    const timeLabel = getTimeRangeLabel();
    let text = `🔔 NHẮC NHỞ CHỈ TIÊU CSKV - ${timeLabel.toUpperCase()}\n`;
    text += `Định mức: ${DAILY_QUOTA} trường hợp/ngày (có cộng dồn ngày thiếu)\n`;
    if (meta.periodStart && meta.periodEnd) {
      text += `Tính từ: ${formatYmdToVi(meta.periodStart)} đến ${formatYmdToVi(meta.periodEnd)} (${meta.daysCount || 0} ngày)\n`;
    }
    text += `------------------------------------\n`;

    if (reminders.length === 0) {
      text += `✅ Tất cả ${meta.totalRegions || 22} đồng chí đã hoàn thành đủ chỉ tiêu!\n`;
    } else {
      text += `Danh sách chưa hoàn thành (${reminders.length} đồng chí):\n`;
      reminders.forEach((item, idx) => {
        text += `${idx + 1}. ${item.region_name}: còn thiếu ${item.missing_count} trường hợp (đã gửi ${item.total_uploaded}/${item.total_quota})\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (onShowToast) onShowToast('success', 'Đã sao chép danh sách nhắc nhở vào bộ nhớ tạm!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="container" style={{ maxWidth: '1100px' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #b45309 0%, #991b1b 55%, #7f1d1d 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.85rem 1.75rem',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(153, 27, 27, 0.25)',
          marginBottom: '1.5rem',
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
                background: 'rgba(251, 191, 36, 0.22)',
                color: '#fef08a',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: '1px solid rgba(251, 191, 36, 0.45)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              <Bell size={14} color="#fef08a" />
              Nhắc Nhở Chỉ Tiêu
            </span>
            <span style={{ fontSize: '0.85rem', color: '#fef3c7', opacity: 0.95 }}>
              Định mức: <strong>{DAILY_QUOTA} trường hợp / ngày</strong> (1 ảnh = 1 trường hợp)
            </span>
          </div>

          <h1
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              letterSpacing: '0.01em',
              color: '#ffffff',
              marginBottom: '0.4rem',
              lineHeight: 1.25
            }}
          >
            THEO DÕI & NHẮC NHỞ CHƯA ĐẠT CHỈ TIÊU
          </h1>
          <p style={{ color: '#fef2f2', fontSize: '0.92rem', maxWidth: '820px', lineHeight: 1.5, opacity: 0.95 }}>
            Mỗi ngày mỗi đồng chí cần gửi đủ <strong>{DAILY_QUOTA} ảnh</strong>. Nếu gửi thiếu sẽ
            <strong> cộng dồn</strong> sang ngày sau; nếu gửi vượt chỉ tiêu (vd 25/15) sẽ <strong>tự động bù trừ (+10)</strong> cho ngày tiếp theo.
            Bấm vào từng đồng chí để xem chi tiết ngày nào thiếu bao nhiêu trường hợp.
          </p>
        </div>
      </div>

      {/* Filter Controls Card */}
      <div
        className="glass-card"
        style={{
          marginBottom: '1.5rem',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700 }}>
              Bộ Lọc Thời Gian
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
                className={`btn ${timeRange === 'week' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.1rem', fontWeight: 700 }}
                onClick={() => setTimeRange('week')}
              >
                <Calendar size={16} />
                <span>Theo Tuần</span>
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
                className={`btn ${timeRange === 'year' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.9rem', padding: '0.5rem 1.1rem', fontWeight: 700 }}
                onClick={() => setTimeRange('year')}
              >
                <Calendar size={16} />
                <span>Theo Năm</span>
              </button>
            </div>
          </div>

          {/* Preset & Specific Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {timeRange === 'day' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn ${selectedDate === todayStr ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => handleSelectedDateChange(todayStr)}
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  className={`btn ${selectedDate === yesterdayStr ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => handleSelectedDateChange(yesterdayStr)}
                >
                  Hôm qua
                </button>
                <input
                  type="date"
                  className="form-control"
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', width: 'auto' }}
                  value={selectedDate}
                  onChange={(e) => e.target.value && handleSelectedDateChange(e.target.value)}
                  title="Chọn ngày xem nhắc nhở"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Cộng dồn từ:
                  </span>
                  <input
                    type="date"
                    className="form-control"
                    style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', width: 'auto' }}
                    value={quotaStartDate}
                    max={selectedDate}
                    onChange={(e) => e.target.value && setQuotaStartDate(e.target.value)}
                    title="Ngày bắt đầu tính cộng dồn chỉ tiêu"
                  />
                </div>
              </div>
            )}

            {timeRange === 'week' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn ${selectedWeek === currentWeekStr ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => setSelectedWeek(currentWeekStr)}
                >
                  Tuần này
                </button>
                <button
                  type="button"
                  className={`btn ${selectedWeek === prevWeekStr ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => setSelectedWeek(prevWeekStr)}
                >
                  Tuần trước
                </button>
                <input
                  type="week"
                  className="form-control"
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', width: 'auto' }}
                  value={selectedWeek}
                  onChange={(e) => e.target.value && setSelectedWeek(e.target.value)}
                  title="Chọn tuần cụ thể"
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  ({parseWeekRange(selectedWeek).startDisplay} - {parseWeekRange(selectedWeek).endDisplay})
                </span>
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
                  onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                  title="Chọn tháng cụ thể"
                />
              </div>
            )}

            {timeRange === 'year' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn ${selectedYear === String(currentYear) ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => setSelectedYear(String(currentYear))}
                >
                  Năm nay
                </button>
                <button
                  type="button"
                  className={`btn ${selectedYear === String(prevYear) ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => setSelectedYear(String(prevYear))}
                >
                  Năm trước
                </button>
                <input
                  type="number"
                  className="form-control"
                  min="2000"
                  max="2100"
                  step="1"
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', width: '110px' }}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  title="Chọn năm cụ thể"
                />
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
              onClick={fetchReminders}
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
              <span>Làm Mới</span>
            </button>
          </div>
        </div>

        {/* Period info + Search & Actions */}
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
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Kỳ tính: <strong>{getTimeRangeLabel()}</strong>
            {meta.daysCount > 0 && (
              <span>
                {' '}
                ({formatYmdToVi(meta.periodStart)} → {formatYmdToVi(meta.periodEnd)} • {meta.daysCount} ngày • Chỉ tiêu{' '}
                <strong>{meta.daysCount * DAILY_QUOTA}</strong> trường hợp/người)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="Tìm theo tên CSKV..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2rem', paddingRight: '0.75rem', fontSize: '0.85rem', width: '210px' }}
              />
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
              onClick={handleCopyReminder}
              title="Sao chép danh sách nhắc nhở để gửi vào nhóm Zalo"
            >
              {copied ? <Check size={15} color="var(--accent-emerald)" /> : <Copy size={15} />}
              <span>{copied ? 'Đã Sao Chép' : 'Sao Chép Nhắc Nhở'}</span>
            </button>

            {onNavigateUpload && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
                onClick={onNavigateUpload}
              >
                <Send size={15} />
                <span>Gửi Ảnh Ngay</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div className="glass-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(220, 38, 38, 0.12)',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>CHƯA HOÀN THÀNH</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#dc2626' }}>
              {meta.incompleteCount || 0} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>/ {meta.totalRegions || 0} người</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--accent-emerald)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>ĐÃ ĐẠT CHỈ TIÊU</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
              {meta.completedCount || 0} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>đồng chí</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(217, 119, 6, 0.12)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG CÒN THIẾU</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706' }}>
              {meta.totalMissing || 0} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>trường hợp</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} color="#dc2626" />
            <span>Danh Sách Chưa Hoàn Thành Chỉ Tiêu ({filteredReminders.length})</span>
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin-animation" style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
            <div>Đang tính toán chỉ tiêu và công nợ cộng dồn...</div>
          </div>
        ) : filteredReminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            {reminders.length === 0 ? (
              <>
                <CheckCircle2 size={48} color="var(--accent-emerald)" style={{ marginBottom: '0.75rem' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--accent-emerald)' }}>
                  Tuyệt Vời! Không Có Đồng Chí Nào Thiếu Chỉ Tiêu
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
                  Tất cả {meta.totalRegions || 22} đồng chí đều đã hoàn thành đủ định mức trong kỳ này.
                </p>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Không tìm thấy cán bộ nào khớp với từ khóa "{searchTerm}".
              </p>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 0.65rem', width: '50px' }}>STT</th>
                  <th style={{ padding: '0.75rem 0.75rem' }}>Người Gửi (CSKV)</th>
                  <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Đã Gửi / Tổng Chỉ Tiêu</th>
                  {timeRange === 'day' && (
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Chi Tiết Ngày</th>
                  )}
                  <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>Chưa Hoàn Thành</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '110px', textAlign: 'center' }}>Theo Ngày</th>
                </tr>
              </thead>
              <tbody>
                {filteredReminders.map((item, idx) => {
                  const pct =
                    item.total_quota > 0
                      ? Math.min(100, Math.round((item.total_uploaded / item.total_quota) * 100))
                      : 0;
                  const isExpanded = expandedRegionId === item.region_id;
                  const breakdown = Array.isArray(item.daily_breakdown) ? item.daily_breakdown : [];
                  const visibleDays = onlyShortDays
                    ? breakdown.filter((d) => d.daily_diff < 0)
                    : breakdown;
                  const colCount = timeRange === 'day' ? 6 : 5;

                  return (
                    <React.Fragment key={item.region_id}>
                      <tr
                        onClick={() => setExpandedRegionId(isExpanded ? null : item.region_id)}
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)',
                          transition: 'background 0.15s ease',
                          cursor: 'pointer',
                          background: isExpanded ? 'rgba(254, 242, 242, 0.5)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '0.85rem 0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                            {item.region_name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {item.region_code}
                            {item.short_days_count > 0 && (
                              <span style={{ marginLeft: '0.5rem', color: '#b45309', fontWeight: 600 }}>
                                • {item.short_days_count} ngày chưa đủ {DAILY_QUOTA}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.total_uploaded} / {item.total_quota}
                          </div>
                          <div
                            style={{
                              width: '120px',
                              height: '6px',
                              background: '#e2e8f0',
                              borderRadius: '999px',
                              margin: '0.35rem auto 0',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: pct >= 80 ? '#f59e0b' : '#dc2626',
                                borderRadius: '999px'
                              }}
                            />
                          </div>
                        </td>
                        {timeRange === 'day' && (
                          <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                            <div>
                              Hôm đó: <strong>{item.target_date_uploaded}</strong> / {item.target_date_quota}
                            </div>
                            {item.carried_over > 0 && (
                              <div style={{ color: '#b45309', fontSize: '0.76rem', fontWeight: 600 }}>
                                (Gồm +{item.carried_over} thiếu từ ngày trước)
                              </div>
                            )}
                            {item.carried_over < 0 && (
                              <div style={{ color: 'var(--accent-emerald)', fontSize: '0.76rem', fontWeight: 600 }}>
                                (Đã bù trừ {Math.abs(item.carried_over)} dư từ ngày trước)
                              </div>
                            )}
                          </td>
                        )}
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: 'rgba(220, 38, 38, 0.12)',
                              color: '#dc2626',
                              border: '1px solid rgba(220, 38, 38, 0.25)',
                              padding: '0.35rem 0.85rem',
                              borderRadius: 'var(--radius-full)',
                              fontWeight: 800,
                              fontSize: '0.88rem'
                            }}
                          >
                            Thiếu {item.missing_count} trường hợp
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRegionId(isExpanded ? null : item.region_id);
                            }}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: '#f8fafc' }}>
                          <td colSpan={colCount} style={{ padding: '0.85rem 1rem 1.15rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Lịch sử từng ngày của <span style={{ color: '#991b1b' }}>{item.region_name}</span> ({breakdown.length} ngày)
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  className={`btn ${onlyShortDays ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ fontSize: '0.76rem', padding: '0.28rem 0.65rem' }}
                                  onClick={() => setOnlyShortDays(true)}
                                >
                                  Chỉ hiện ngày thiếu ({breakdown.filter((d) => d.daily_diff < 0).length})
                                </button>
                                <button
                                  type="button"
                                  className={`btn ${!onlyShortDays ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ fontSize: '0.76rem', padding: '0.28rem 0.65rem' }}
                                  onClick={() => setOnlyShortDays(false)}
                                >
                                  Tất cả các ngày ({breakdown.length})
                                </button>
                              </div>
                            </div>

                            {visibleDays.length === 0 ? (
                              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                                Không có ngày nào bị thiếu trong danh sách lọc.
                              </div>
                            ) : (
                              <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: '#ffffff' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                  <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                      <th style={{ padding: '0.5rem 0.75rem' }}>Ngày</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Đã Gửi / Định Mức</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Chênh Lệch Ngày</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Cần Gửi (Sau Bù Trừ)</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Lũy Kế Cuối Ngày</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {visibleDays.map((d) => {
                                      const isShort = d.daily_diff < 0;
                                      const isSurplus = d.daily_diff > 0;
                                      return (
                                        <tr key={d.date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>
                                            {formatYmdToVi(d.date)}
                                          </td>
                                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center' }}>
                                            <strong>{d.uploaded}</strong> / {d.quota}
                                          </td>
                                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center', fontWeight: 700, color: isShort ? '#dc2626' : isSurplus ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                                            {isShort
                                              ? `Thiếu ${Math.abs(d.daily_diff)}`
                                              : isSurplus
                                              ? `+${d.daily_diff} (Dư bù trừ)`
                                              : 'Đủ (0)'}
                                          </td>
                                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            {d.effective_target}
                                          </td>
                                          <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>
                                            {d.cumulative_balance < 0 ? (
                                              <span style={{ color: '#dc2626' }}>Còn thiếu {Math.abs(d.cumulative_balance)}</span>
                                            ) : d.cumulative_balance > 0 ? (
                                              <span style={{ color: 'var(--accent-emerald)' }}>Dư +{d.cumulative_balance}</span>
                                            ) : (
                                              <span style={{ color: 'var(--accent-emerald)' }}>Đủ (0)</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
