import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  MapPin, 
  User, 
  Calendar, 
  FileText, 
  Tag,
  Image as ImageIcon, 
  X, 
  CheckCircle2, 
  Camera,
  RefreshCw,
  Send
} from 'lucide-react';

const MAX_IMAGES = 1;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const DEFAULT_CATEGORIES = [
  'Cài đặt ứng dụng SOS',
  'Thực hiện định danh mức 2',
  'Góp ý cải cách thủ tục hành chính',
  'Góp ý sửa đổi bộ luật hình sự'
];

export default function GuestUploadPage({ onShowToast }) {
  const [regions, setRegions] = useState([]);
  const [loadingRegions, setLoadingRegions] = useState(true);

  // Form State
  const [guestName, setGuestName] = useState(() => localStorage.getItem('ck_guest_name') || '');
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]); // array of { file, previewUrl, id, size }

  // Upload status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submittedData, setSubmittedData] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Validation helpers
  const isNameValid = guestName.trim().length >= 2;
  const isRegionValid = Boolean(selectedRegionId);
  const isCategoryValid = Boolean(selectedCategory);
  const hasImages = selectedFiles.length > 0;
  const isFormValid = isNameValid && isRegionValid && isCategoryValid && hasImages;

  // Load Regions & Categories
  useEffect(() => {
    fetchRegions();
    fetchCategories();
  }, []);

  const fetchRegions = async () => {
    try {
      setLoadingRegions(true);
      const res = await fetch('/api/regions');
      const data = await res.json();
      if (data.success && data.data) {
        setRegions(data.data);
        if (data.data.length > 0 && !selectedRegionId) {
          setSelectedRegionId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching regions:', err);
      onShowToast('error', 'Không thể tải danh sách khu vực. Vui lòng thử lại.');
    } finally {
      setLoadingRegions(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setCategories(data.data);
        setSelectedCategory(data.data[0]);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  // Handle files selection (strictly 1 image per submission)
  const handleFiles = (incomingFiles) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    const fileList = Array.from(incomingFiles);
    const validFiles = [];
    let oversizedCount = 0;

    for (const file of fileList) {
      if (!file.type.startsWith('image/')) {
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        oversizedCount++;
        continue;
      }

      validFiles.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        size: file.size
      });
    }

    if (oversizedCount > 0) {
      onShowToast('error', 'Ảnh vượt quá dung lượng tối đa 10MB và đã bị bỏ qua.');
    }

    if (validFiles.length === 0) return;

    if (fileList.length > 1) {
      onShowToast('info', 'Mỗi lần gửi chỉ được đính kèm 1 ảnh. Đã chọn ảnh đầu tiên.');
    }

    setSelectedFiles((prev) => {
      // Clean up previous preview URL
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      // Keep only 1 image
      return [validFiles[0]];
    });
  };

  const removeFile = (id) => {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!guestName.trim() || guestName.trim().length < 2) {
      onShowToast('error', 'Vui lòng nhập đầy đủ Họ và tên của bạn (tối thiểu 2 ký tự).');
      return;
    }

    if (!selectedRegionId) {
      onShowToast('error', 'Vui lòng chọn Khu vực / CSKV tiếp nhận.');
      return;
    }

    if (!selectedCategory) {
      onShowToast('error', 'Vui lòng chọn Mục nội dung góp ý.');
      return;
    }

    if (!reportDate) {
      onShowToast('error', 'Vui lòng chọn Ngày báo cáo.');
      return;
    }

    if (selectedFiles.length === 0) {
      onShowToast('error', 'Ràng buộc bắt buộc: Bạn phải chọn hoặc chụp 1 hình ảnh trước khi gửi!');
      return;
    }

    if (selectedFiles.length > MAX_IMAGES) {
      onShowToast('error', `Mỗi lần gửi chỉ được đính kèm tối đa ${MAX_IMAGES} hình ảnh.`);
      return;
    }

    // Save guest name for convenience
    localStorage.setItem('ck_guest_name', guestName.trim());

    setIsSubmitting(true);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append('guest_name', guestName.trim());
    formData.append('region_id', selectedRegionId);
    formData.append('category', selectedCategory);
    formData.append('report_date', reportDate);
    formData.append('note', note.trim());

    selectedFiles.forEach((item) => {
      formData.append('images', item.file);
    });

    try {
      setUploadProgress(50);
      const res = await fetch('/api/reports', {
        method: 'POST',
        body: formData
      });

      let result = null;
      try {
        result = await res.json();
      } catch (parseErr) {
        result = null;
      }
      setUploadProgress(100);

      if (res.ok && result?.success) {
        setSubmittedData(result.data);
        onShowToast('success', 'Báo cáo và hình ảnh góp ý đã được gửi thành công!');
        // Clean up file previews
        selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        setSelectedFiles([]);
        setNote('');
      } else {
        const errorMsg = result?.message || (res.status === 429 
          ? 'Bạn đã gửi yêu cầu quá nhanh. Mỗi người dùng chỉ được gửi tối đa 6 báo cáo trong 1 phút. Vui lòng thử lại sau.' 
          : 'Lỗi khi gửi báo cáo.');
        onShowToast('error', errorMsg);
      }
    } catch (err) {
      console.error('Submit error:', err);
      onShowToast('error', 'Lỗi kết nối máy chủ. Vui lòng kiểm tra lại mạng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalBytes = selectedFiles.reduce((acc, curr) => acc + curr.size, 0);

  // Success view
  if (submittedData) {
    return (
      <div className="container" style={{ maxWidth: '640px' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--accent-emerald)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)'
            }}
          >
            <CheckCircle2 size={40} />
          </div>

          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Gửi Góp Ý & Báo Cáo Thành Công!
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.95rem' }}>
            Hình ảnh và ý kiến đóng góp của bạn đã được ghi nhận vào hệ thống.
          </p>

          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '2rem',
              textAlign: 'left',
              display: 'grid',
              gap: '0.75rem',
              fontSize: '0.9rem',
              color: 'var(--text-primary)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Mã báo cáo:</span>
              <strong style={{ color: 'var(--primary)' }}>#{submittedData.reportId}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Người gửi:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{submittedData.guestName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Cảnh sát khu vực:</span>
              <span className="badge badge-cyan">{submittedData.regionName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Mục nội dung góp ý:</span>
              <span className="badge badge-primary">{submittedData.category}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ngày báo cáo:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{submittedData.reportDate}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Số lượng ảnh:</span>
              <span className="badge badge-emerald">{submittedData.imageCount} ảnh</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setSubmittedData(null)}
            >
              <RefreshCw size={18} />
              <span>Gửi Thêm Báo Cáo Khác</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '780px' }}>
      <div className="page-header">
        <h1>Gửi Ảnh Thực Hiện</h1>
      </div>

      <form onSubmit={handleSubmit} className="glass-card">
        {/* Row 1: Name and Region */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {/* Guest Name */}
          <div className="form-group">
            <label className="form-label">
              <User size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Họ và Tên của bạn <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Nguyễn Văn An"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
            />
          </div>

          {/* Region Select */}
          <div className="form-group">
            <label className="form-label">
              <MapPin size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Cảnh Sát Khu Vực <span className="required">*</span>
            </label>
            <select
              className="form-control"
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              disabled={loadingRegions}
              required
            >
              {regions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Category and Date */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {/* Feedback Category */}
          <div className="form-group">
            <label className="form-label">
              <Tag size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Mục Nội Dung Góp Ý <span className="required">*</span>
            </label>
            <select
              className="form-control"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              required
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="form-group">
            <label className="form-label">
              <Calendar size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Ngày Báo Cáo
            </label>
            <input
              type="date"
              className="form-control"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Upload Dropzone */}
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label className="form-label" style={{ margin: 0 }}>
              <ImageIcon size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Hình Ảnh Đính Kèm <span className="required">*</span>
            </label>
            <span style={{ fontSize: '0.8rem', color: selectedFiles.length >= MAX_IMAGES ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
              Đã chọn: <strong>{selectedFiles.length}</strong> / {MAX_IMAGES} ảnh {totalBytes > 0 && `(${formatFileSize(totalBytes)})`}
            </span>
          </div>

          <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="dropzone-icon">
              <UploadCloud size={28} />
            </div>
            <div className="dropzone-title">Kéo & Thả ảnh vào đây hoặc nhấp để tải ảnh lên</div>
            <div className="dropzone-subtitle">
              Hỗ trợ JPG, PNG, WEBP, ảnh chụp màn hình (Tối đa 1 ảnh, dung lượng ≤ 10MB)
            </div>

            {/* Quick Actions inside Dropzone */}
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
                marginTop: '1.25rem'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={16} />
                <span>Chọn File Từ Máy</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={16} />
                <span>Chụp Ảnh Camera</span>
              </button>
            </div>

            {/* Hidden native inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* Selected Image Info (No thumbnail to avoid heavy loading) */}
        {selectedFiles.length > 0 && (
          <div style={{ 
            marginTop: '1.25rem', 
            padding: '0.75rem 1rem', 
            background: 'rgba(255, 255, 255, 0.04)', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-subtle)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>✓ Đã chọn ảnh:</span>
              <strong style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{selectedFiles[0]?.file?.name}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({formatFileSize(selectedFiles[0]?.size)})</span>
            </div>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-rose)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '0.2rem 0.5rem'
              }}
              onClick={() => {
                selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
                setSelectedFiles([]);
              }}
            >
              Xóa ảnh
            </button>
          </div>
        )}

        {/* Submit Button */}
        <div style={{ marginTop: '1.25rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              padding: '0.95rem', 
              fontSize: '1.05rem',
              opacity: isFormValid && !isSubmitting ? 1 : 0.65,
              cursor: isFormValid && !isSubmitting ? 'pointer' : 'not-allowed'
            }}
            disabled={isSubmitting || !isFormValid}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={20} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Đang Tải Lên Hệ Thống... ({uploadProgress}%)</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>
                  {!hasImages 
                    ? 'Vui lòng đính kèm ít nhất 1 ảnh để gửi' 
                    : !isNameValid 
                    ? 'Vui lòng nhập Họ và tên' 
                    : `Gửi Góp Ý Báo Cáo (${selectedFiles.length} Ảnh)`
                  }
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
