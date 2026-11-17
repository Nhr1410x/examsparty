# Xóa nhiều đề trong quản trị

Giữ bố cục quản trị hiện tại. Chọn từng đề hoặc toàn bộ đề trong trang, xác nhận trước khi xóa. Bỏ lựa chọn khi tìm kiếm hoặc chuyển trang. Không thêm phụ thuộc hay chức năng khôi phục.

Xóa mềm bằng trạng thái `deleted`: ẩn khỏi quản trị, thống kê đề và kho công khai; giữ bài làm, câu hỏi dùng chung, báo lỗi và nhật ký. Không cho sửa hoặc gắn thêm câu hỏi vào đề đã xóa. API chỉ dành cho admin, kiểm tra Origin và danh sách UUID, khóa các đề và xử lý trong giao dịch.

1. Thêm kiểm thử API cho xóa nhiều đề, xác thực/CSRF, dữ liệu đầu vào, đề không tồn tại/đã xóa, nhật ký và bảo toàn bài làm/câu hỏi; chạy để thấy thất bại.
2. Thêm `DELETE /api/admin/exams` với `{ ids }`, cập nhật bộ lọc và chặn sửa đề đã xóa trong `backend/src/app.js`.
3. Thêm kiểm thử React qua trang Admin: chọn nhiều, chọn cả trang, hủy xác nhận, xóa thành công/thất bại và bỏ lựa chọn khi tìm kiếm.
4. Thêm lựa chọn và thao tác xóa vào `ManageExams` trong `frontend/src/admin.tsx`, dùng checkbox, button và thông báo sẵn có.
5. Chạy `npm.cmd run check` và `npm.cmd run build`; kiểm tra lại phạm vi và các thay đổi.
