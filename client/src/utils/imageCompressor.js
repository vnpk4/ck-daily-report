/**
 * Tiện ích Nén Ảnh Thông Minh (Adaptive / Smart Image Compression)
 * 
 * Nguyên tắc:
 * 1. KHÔNG nén ảnh có dung lượng nhẹ sẵn (<= 600KB).
 * 2. KHÔNG can thiệp ảnh GIF động hoặc SVG vector.
 * 3. Chỉ tối ưu ảnh camera/ảnh nặng (> 600KB hoặc độ phân giải vượt quá 1600px).
 * 4. Nếu sau khi nén dung lượng không nhỏ hơn file gốc -> Giữ nguyên 100% file gốc.
 */

const MAX_IMAGE_DIMENSION = 1600; // Chiều dài/rộng tối đa (1600px đủ cực nét cho mọi loại báo cáo)
const COMPRESSION_QUALITY = 0.82; // Chất lượng JPEG 82% (mắt thường không phân biệt được với ảnh gốc)
const SKIP_COMPRESSION_SIZE = 600 * 1024; // 600KB: Dưới mức này giữ nguyên bản gốc

/**
 * Nén 1 file ảnh có điều kiện
 * @param {File} file 
 * @returns {Promise<File>}
 */
export async function smartCompressImage(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    return file;
  }

  // Bỏ qua ảnh động GIF hoặc vector SVG
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  // 1. Nếu ảnh đã nhẹ sẵn (<= 600KB), giữ nguyên bản gốc 100%
  if (file.size <= SKIP_COMPRESSION_SIZE) {
    return file;
  }

  // Thử dùng createImageBitmap (hỗ trợ đọc hướng xoay EXIF tự động, xử lý ngầm rất nhanh)
  if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
      let { width, height } = bitmap;

      // Nếu độ phân giải đã nhỏ hơn 1600px và dung lượng dưới 1MB, giữ nguyên
      if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION && file.size <= 1024 * 1024) {
        bitmap.close?.();
        return file;
      }

      // Tính toán kích thước mới giữ nguyên tỷ lệ
      if (width > height) {
        if (width > MAX_IMAGE_DIMENSION) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width = MAX_IMAGE_DIMENSION;
        }
      } else {
        if (height > MAX_IMAGE_DIMENSION) {
          width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();

        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', COMPRESSION_QUALITY);
        });

        // Nếu nén xong mà không giảm dung lượng so với file gốc, dùng lại file gốc
        if (blob && blob.size < file.size) {
          const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          return new File([blob], newName, {
            type: 'image/jpeg',
            lastModified: file.lastModified || Date.now()
          });
        }
      }
      bitmap.close?.();
    } catch (bitmapErr) {
      // Fallback sang HTMLImageElement bên dưới nếu createImageBitmap gặp trục trặc
    }
  }

  // Fallback dùng Image element & Object URL
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { naturalWidth: width, naturalHeight: height } = img;

      if (!width || !height || (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION && file.size <= 1024 * 1024)) {
        resolve(file);
        return;
      }

      if (width > height) {
        if (width > MAX_IMAGE_DIMENSION) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width = MAX_IMAGE_DIMENSION;
        }
      } else {
        if (height > MAX_IMAGE_DIMENSION) {
          width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          resolve(new File([blob], newName, {
            type: 'image/jpeg',
            lastModified: file.lastModified || Date.now()
          }));
        },
        'image/jpeg',
        COMPRESSION_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Tối ưu danh sách nhiều ảnh cùng lúc (song song)
 * @param {File[]} fileList 
 * @returns {Promise<{ files: File[], originalTotalBytes: number, optimizedTotalBytes: number, savedBytes: number }>}
 */
export async function batchOptimizeImages(fileList) {
  const originalTotalBytes = fileList.reduce((acc, f) => acc + (f.size || 0), 0);

  const files = await Promise.all(
    fileList.map(async (file) => {
      try {
        return await smartCompressImage(file);
      } catch (err) {
        console.warn('Smart compression error, using original:', err);
        return file;
      }
    })
  );

  const optimizedTotalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const savedBytes = Math.max(0, originalTotalBytes - optimizedTotalBytes);

  return {
    files,
    originalTotalBytes,
    optimizedTotalBytes,
    savedBytes
  };
}
