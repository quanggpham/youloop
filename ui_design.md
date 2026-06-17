# Tài liệu Thiết kế Smart Video Loop (SVL)

Dưới đây là các thông tin chi tiết về hệ thống UI của tiện ích mở rộng Chrome "Smart Video Loop".

---

## 1. Thư viện Thành phần (UI Pieces)

Các thành phần được thiết kế để nhúng trực tiếp vào trình phát YouTube, sử dụng màu hồng chủ đạo (#FF4081) để phân biệt với màu đỏ mặc định của YouTube.

### A. Thanh Điều khiển Vòng lặp (Loop Control Bar)
- **Toggle Loop Button (A↻B):** Nút chuyển đổi trạng thái vòng lặp.
- **Set A/B Buttons:** Nút đặt điểm đầu và điểm cuối của đoạn video.
- **Time Display:** Hiển thị thời gian định dạng `phút:giây`.

### B. Dấu mốc Thanh Tiến trình (Progress Bar Markers)
- **Markers:** Thanh dọc 3px với tay cầm tròn 6px ở trên cùng.
- **Highlight Region:** Vùng màu hồng nhạt (rgba(255, 64, 129, 0.25)) hiển thị đoạn video đang lặp.

### C. Thông báo & Cảnh báo (Toasts & Warnings)
- **Toast Notification:** Thông báo lỗi (ví dụ: "Start and end cannot be equal") xuất hiện ở góc trên bên phải.
- **Warning Indicator:** Biểu tượng cảnh báo nhỏ màu vàng khi đoạn lặp quá ngắn (< 1 giây).

---

## 2. Mockup Full Player

Hệ thống UI được hiển thị trong hai trạng thái chính trên trình phát YouTube:

### Trạng thái Trống (Empty State)
- Xem chi tiết tại: `{{DATA:SCREEN:SCREEN_2}}`
- Mô tả: Các nút điều khiển hiển thị nhưng chưa có điểm A/B. Thanh tiến trình sạch sẽ.

### Trạng thái Đang lặp (Looping State)
- Xem chi tiết tại: `{{DATA:SCREEN:SCREEN_6}}`
- Mô tả: Nút A↻B ở trạng thái Active (nền hồng). Các mốc A và B xuất hiện trên thanh tiến trình kèm theo vùng highlight.

---

## 3. Thông số Tương tác (Interaction Specs)

Mọi tương tác được thiết kế để tạo cảm giác "Native" (tự nhiên) như là một phần của YouTube.

| Thành phần | Trạng thái Hover | Trạng thái Active | Animation |
| :--- | :--- | :--- | :--- |
| **Nút A↻B** | Tăng độ sáng (brightness), hiển thị Tooltip | Nền hồng (#FF4081), chữ đen | Transition: background 0.15s ease |
| **Nút Set A/B** | Viền hồng đậm hơn, Tooltip | Hiệu ứng nhấn nhẹ | Transition: border-color 0.15s |
| **Markers** | Độ rộng tăng từ 3px lên 5px, con trỏ `ew-resize` | Giữ độ rộng 5px, tăng độ mờ (opacity) | Smooth width transition |
| **Toast** | - | - | Fade-in/out (300ms) |

---

## 4. CSS Design Tokens

Sử dụng các biến CSS sau để đảm bảo tính đồng nhất trong mã nguồn:

```css
:root {
  /* Colors */
  --svl-accent: #FF4081;
  --svl-accent-dim: rgba(255, 64, 129, 0.25);
  --svl-bg-controls: rgba(0, 0, 0, 0.4);
  --svl-text: #FFFFFF;
  --svl-text-dim: #AAAAAA;
  
  /* Dimensions */
  --svl-marker-width: 3px;
  --svl-marker-width-hover: 5px;
  --svl-radius: 4px;
  
  /* Typography */
  --svl-font: 'YouTube Sans', 'Roboto', Arial, sans-serif;
  --svl-font-mono: 'Roboto Mono', monospace;
  
  /* Z-index */
  --svl-z-index: 2000; /* Phải cao hơn YouTube controls */
}
```

---
*Tài liệu này được tạo dựa trên các thiết kế hiện có trong dự án.*