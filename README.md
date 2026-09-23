# CK Daily Report - Hệ Thống Báo Cáo Hình Ảnh Hàng Ngày

Hệ thống web thu thập hình ảnh báo cáo hiện trường hàng ngày theo khu vực dành cho khách (**Guest**) và giao diện quản trị (**Admin**) tra cứu, lọc và xuất file ZIP hàng loạt theo chuẩn phân tầng khoa học.

---

## 🌟 Tính Năng Nổi Bật

### 1. Dành Cho Khách / Nhân Viên Hiện Trường (Guest)
- **Form gửi nhanh & tiện lợi**: Tự động lưu nhớ họ tên trên thiết bị để không phải gõ lại mỗi lần gửi.
- **Chọn Khu vực**: Tích hợp sẵn **22 khu vực** (tên có thể cập nhật linh hoạt theo thực tế).
- **Hỗ trợ chụp ảnh trực tiếp**: Bấm nút chụp ảnh từ camera điện thoại hoặc chọn ảnh có sẵn từ thư viện / ảnh chụp màn hình máy tính.
- **Giới hạn & Kiểm tra an toàn**:
  - Tối đa **10 ảnh / lần gửi**.
  - Tối đa **10 MB / ảnh**.
  - Hiển thị xem trước hình ảnh, dung lượng từng ảnh, nút xóa ảnh trước khi bấm gửi.
- **Tiến trình tải lên**: Thanh tiến trình và màn hình xác nhận kèm mã số báo cáo ngay sau khi gửi thành công.

### 2. Dành Cho Quản Trị Viên (Admin)
- **Bảo mật**: Khóa trang bằng **Mã PIN Quản Trị** (Mặc định: `123456`, có thể đổi trong `.env`).
- **Thống kê tổng quan**: Số lượt báo cáo, tổng số ảnh trong kho, số báo cáo trong ngày, số ảnh thỏa mãn bộ lọc.
- **Bộ lọc đa năng**:
  - Lọc theo từng khu vực hoặc tất cả 22 khu vực.
  - Phím tắt mốc thời gian: *Hôm nay*, *Hôm qua*, *7 ngày qua*, *Tất cả*, hoặc *Chọn khoảng ngày bất kỳ*.
  - Tìm kiếm theo tên người gửi hoặc nội dung ghi chú.
- **Xem ảnh & Lightbox chuyên nghiệp**: Xem ảnh kích thước đầy đủ, phóng to, thu nhỏ, xoay ảnh, tải riêng từng ảnh.
- **Xuất File ZIP Chuẩn Mẫu B**:
  - Tự động nén tất cả hình ảnh theo bộ lọc đang xem.
  - Phân tầng thư mục: `[Tên_Khu_Vực] / [YYYY-MM-DD] / [Tên_Người_Gửi]_[01..10].[ext]`
  - Ví dụ: `Khu_vực_1/2026-09-23/Nguyễn_Văn_Tuấn_01.png`
- **Quản lý & Đổi tên Khu vực**: Bấm vào nút *Quản Lý Khu Vực* để đổi tên bất kỳ khu vực nào từ 1 đến 22 (ví dụ: đổi thành `Xưởng 1 - Dây Chuyền Lắp Ráp`).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Tại Máy (Local)

### Yêu Cầu Hệ Thống:
- Node.js version 22+ (Dự án sử dụng Node.js 24 với SQLite tích hợp sẵn, không cần cài MySQL hay SQL Server).

### 1. Chạy Chế Độ Phát Triển (Development - Tự động tải lại khi sửa code):
```bash
npm run dev
```
- Server chạy tại: `http://localhost:3001`
- Frontend Vite chạy tại: `http://localhost:5173` (đã cấu hình proxy tự động sang 3001).

### 2. Chạy Chế Độ Sản Xuất (Production - 1 Cổng duy nhất):
```bash
# Bước 1: Build giao diện React
npm run build

# Bước 2: Khởi động server
npm start
```
Truy cập vào trình duyệt: `http://localhost:3001`

---

## 🌐 Hướng Dẫn Deploy Lên Internet (Online)

Dự án được tối ưu theo mô hình **Single-Service (Express phục vụ cả API và giao diện React build)**, do đó bạn có thể đưa lên mạng rất dễ dàng:

### Cách 1: Deploy Miễn Phí / Giá Rẻ Trên Render.com
1. Đẩy code dự án lên kho **GitHub** cá nhân của bạn.
2. Đăng nhập [Render.com](https://render.com) -> Chọn **New Web Service**.
3. Kết nối với kho GitHub `CK_DailyReport`.
4. Cấu hình các thông số:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. (Khuyến nghị) Vào mục **Disks** thêm 1 Persistent Disk gắn vào `/app/uploads` và `/app/data` để giữ file lâu dài.
6. Nhấn **Deploy Web Service** -> Bạn sẽ nhận được đường link online (ví dụ: `https://ck-daily-report.onrender.com`).

### Cách 2: Deploy Trên Railway.app
1. Chọn **New Project** -> **Deploy from GitHub repo**.
2. Railway sẽ tự động phát hiện `package.json` và build ứng dụng.
3. Thêm Volume gắn vào `/app/uploads` để lưu trữ ảnh.

### Cách 3: Chạy Bằng Docker Trên VPS (Ubuntu / Debian / CentOS / Windows Server)
```bash
# Build Docker image
docker build -t ck-daily-report .

# Chạy container và lưu dữ liệu persistent trên máy chủ
docker run -d -p 3001:3001 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/data:/app/data \
  --name ck-app \
  ck-daily-report
```

---

## ⚙️ Cấu Hình Môi Trường (.env)

Tạo file `.env` tại thư mục gốc nếu muốn đổi cổng hoặc mã PIN:
```env
PORT=3001
ADMIN_PIN=123456
```
*(Nếu không tạo file `.env`, hệ thống sẽ tự động dùng cổng `3001` và mã PIN `123456`)*.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
CK_DailyReport/
├── client/                     # Mã nguồn giao diện React (Vite)
│   ├── src/
│   │   ├── components/         # Navbar, Lightbox, Toast
│   │   ├── pages/              # GuestUploadPage, AdminDashboardPage
│   │   ├── index.css           # Vanilla CSS Design System cao cấp
│   │   └── App.jsx
│   └── vite.config.js
├── server/                     # Backend Express & SQLite
│   ├── routes/api.js           # Xử lý toàn bộ API (Upload, Lọc, Xuất ZIP, Đổi tên)
│   ├── storage.js              # Cấu hình Multer, kiểm tra 10MB, tối đa 10 ảnh
│   ├── zipService.js           # Đóng gói nén ZIP stream theo Mẫu B
│   ├── db.js                   # Cơ sở dữ liệu SQLite & khởi tạo 22 khu vực
│   └── server.js               # File khởi động chính
├── uploads/                    # Nơi lưu trữ vật lý các file ảnh theo ngày
├── data/                       # Chứa cơ sở dữ liệu SQLite ck_reports.db
├── Dockerfile                  # Đóng gói container chạy bất cứ server nào
└── package.json                # Kịch bản build và điều phối dự án
```
