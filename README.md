# Examsparty

Hệ thống ôn tập và thi trắc nghiệm theo [bản thiết kế](blueprint-he-thong-on-tap.md). Giao diện tiếng Việt, xanh lá, responsive, sáng/tối; khách làm bài không cần đăng nhập.

## Chạy nhanh để xem giao diện

Yêu cầu Node.js >= 22.12 (khuyến nghị Node 24).

```powershell
npm ci
npm run demo
```

Nếu PowerShell báo `npm.ps1 cannot be loaded because running scripts is disabled`, dùng `npm.cmd ci` và `npm.cmd run demo` (không cần đổi Execution Policy). Lệnh chỉ khởi động server; mở trình duyệt tại URL `Local` do Vite in ra, thường là **http://localhost:5173**. Cổng **3001** chỉ phục vụ API, không phải giao diện.

`npm run dev` cần PostgreSQL đang chạy và `backend/.env` có `DATABASE_URL`; nếu chỉ muốn xem giao diện, dùng `npm.cmd run demo`.

Mở **http://localhost:5173**. Bản demo dùng PostgreSQL giả lập trong bộ nhớ, có 6 đề mẫu; dữ liệu mất khi tắt tiến trình. Chỉ dùng xem thử trên máy cá nhân, không deploy chế độ này. Admin demo: `admin@examsparty.local` / `DemoAdmin123!`.

## Chạy với PostgreSQL thật

1. Khởi động Docker Desktop, chạy `docker compose up -d db` (hoặc chuẩn bị PostgreSQL 17).
2. Sao chép `backend/.env.example` thành `backend/.env`; thay email và mật khẩu admin, kiểm tra `DATABASE_URL`.
3. Chạy `npm ci`, rồi `npm run dev`.
4. Mở http://localhost:5173; quản trị tại `/admin`. Bảng dữ liệu được tạo khi API khởi động. `SEED_DEMO=true` chỉ thêm đề mẫu khi chưa có đề nào.

Frontend Vite chạy cổng 5173, API cổng 3001. Dùng đúng `localhost`, không thay bằng `127.0.0.1` nếu chưa sửa `FRONTEND_ORIGIN`. Tài khoản admin chỉ được tạo nếu email chưa tồn tại; thay `ADMIN_PASSWORD` sau đó **không** đặt lại mật khẩu đã lưu.

```powershell
npm run check
npm run build
npm run test:proxy
```

`npm run check` chạy TypeScript, bộ kiểm thử domain/API với pg-mem và kiểm thử React trong DOM giả lập. `npm run test:proxy` build và kiểm tra HTTP thực qua server frontend: đường dẫn SPA, cookie, đăng nhập, đăng xuất và quyền sở hữu bài làm. Cần kiểm chứng thêm trên PostgreSQL thật và trình duyệt trước khi mở production.

## Deploy cả frontend và backend trên Render

Đã có [render.yaml](render.yaml): **2 Node Web Services + Render PostgreSQL**, cùng region Singapore. Frontend là Web Service để chuyển tiếp `/api` qua mạng nội bộ đến backend; trình duyệt chỉ dùng một origin, cookie HttpOnly không phụ thuộc cookie bên thứ ba. Không chọn Static Site với cấu hình này.

Blueprint hiện chọn các gói **trả phí** (`starter`, Postgres `basic-256mb`). Kiểm tra giá trong tài khoản Render trước khi tạo. Không có thao tác tạo dịch vụ hay thanh toán tự động trong dự án.

1. Đưa toàn bộ thư mục vào một Git repository trên GitHub/GitLab, bao gồm `package-lock.json`; không đưa `.env` vào Git.
2. Trên Render chọn **New → Blueprint**, kết nối repository và chọn `render.yaml`.
3. Điền các biến của API:
   - `FRONTEND_ORIGIN`: URL frontend đầy đủ, ví dụ `https://examsparty-web.onrender.com`, **không có dấu `/` cuối**. Khi Render gán tên có hậu tố, phải cập nhật đúng URL thật và redeploy API.
   - `ADMIN_EMAIL`: email chủ hệ thống.
   - `ADMIN_PASSWORD`: mật khẩu riêng ít nhất 12 ký tự, không dùng tài khoản demo.
   - `ADMIN_TOTP_SECRET`: khóa Base32 cho MFA. Tạo khóa cục bộ bằng lệnh bên dưới, lưu trong trình quản lý mật khẩu, thêm tài khoản TOTP tương ứng vào ứng dụng xác thực. API production không khởi động khi thiếu MFA hoặc origin.
4. Render tự gán `DATABASE_URL` từ DB và `API_PROXY_TARGET` từ địa chỉ nội bộ API. Không đưa các biến này vào bundle frontend. `DATABASE_SSL=false` dành cho kết nối DB **nội bộ cùng region**. Nếu dùng external DB có TLS, đặt `DATABASE_SSL=true`; xác thực chứng chỉ vẫn được bật.
5. Chờ `/api/health` của API và `/health` của frontend hoạt động. Mở URL frontend, kiểm tra kho đề, làm bài, admin/MFA và duyệt một đóng góp.
6. Sau khi tạo admin lần đầu, có thể gỡ `ADMIN_PASSWORD` khỏi biến môi trường; tài khoản trong DB vẫn hoạt động. Tắt `SEED_DEMO` nếu không cần thêm đề mẫu trên database trống.

Tạo TOTP secret trên máy cá nhân (lệnh hiển thị khóa; không chia sẻ đầu ra):

```powershell
node --input-type=module -e "import * as OTPAuth from 'otpauth'; console.log(new OTPAuth.Secret({size:20}).base32)"
```

Trong ứng dụng xác thực: tạo tài khoản thủ công với khóa vừa tạo, TOTP 6 chữ số, SHA-1, chu kỳ 30 giây. MVP sử dụng khóa MFA chung do chủ hệ thống giữ; triển khai nhiều admin độc lập cần chuyển sang enrollment TOTP theo tài khoản trước khi cấp quyền rộng.

Đổi tên miền: cập nhật `FRONTEND_ORIGIN` trên API, cấu hình DNS/TLS trong Render rồi redeploy. Không cần bật CORS. Xem [tài liệu Blueprint](https://render.com/docs/blueprint-spec) và [kết nối Postgres](https://render.com/docs/postgresql-creating-connecting).

## Các luồng đã triển khai

- Kho đề: tìm kiếm, phân trang; lọc môn/lớp/chủ đề/dạng câu/mức độ/thời lượng/số câu.
- Ngân hàng câu hỏi đã xuất bản, không lộ đáp án; chọn một đề để luyện và chấm.
- Luyện tập giữ thứ tự; kiểm tra từng câu để mở lời giải; lưu và tiếp tục.
- Thi thử trộn một lần theo cấu hình đề; thời hạn máy chủ; làm mới giữ thứ tự. Hết hạn chấm câu đã lưu; đáp án chỉ có trong kết quả sau nộp.
- Phiên có cookie sở hữu, bản chụp đề độc lập và khóa dòng PostgreSQL khi lưu/nộp. Không thể sửa câu trả lời sau nộp.
- Chọn một/nhiều, đúng/sai theo từng nhận định, đáp án ngắn (chuẩn hóa Unicode, có dung sai số), tự luận chưa chấm. Điểm nhiều lựa chọn mặc định khớp toàn bộ; điểm từng phần khi bật = max(0, số chọn đúng − số chọn thừa) / số đáp án đúng.
- Điểm thang 10; số đúng/sai/bỏ trống/chưa chấm; lọc và tìm trong kết quả. Tự luận có trả lời luôn hiển thị chưa chấm, không tính sai.
- Form soạn đủ 5 dạng, đổi thứ tự câu, nhập JSON, kiểm tra và tải lỗi theo đường dẫn trường, xem trước, gửi pending, mã bí mật theo dõi và gửi lại khi được yêu cầu sửa. Mã theo dõi khôi phục quyền xem ảnh riêng tư trên trình duyệt khác mà không công khai ảnh.
- Admin: đăng nhập, MFA ở production, duyệt/từ chối/yêu cầu sửa, cảnh báo trùng tiêu đề, tìm/lọc và quản lý đề/câu hỏi/tài khoản, dùng chung câu giữa nhiều đề, cấp/khóa tài khoản, nhật ký, báo lỗi, bật/tắt nhận đóng góp. Bản sửa câu hỏi lưu nháp/lưu trữ không thay nội dung công khai của đề; chỉ xuất bản bản sửa mới cập nhật đề liên kết.
- Khối text, LaTeX (KaTeX với trust=false), code chỉ hiển thị, ảnh PNG/JPEG/WebP <= 2 MB. HTML tùy ý bị từ chối. Ảnh đóng góp riêng tư cho tới lúc xuất bản.

## Lưu trữ và vận hành

- Dữ liệu đề/câu/đáp án ở JSONB, metadata có chỉ mục. Câu được liên kết với đề; sửa câu liên kết cập nhật đề, giữ nguyên các bản chụp bài làm cũ. Khi thay toàn bộ đề, các câu cũ được giữ để không phá dữ liệu.
- **Ảnh lưu trong PostgreSQL bytea**, không lưu vào filesystem tạm của Render. Đây là lựa chọn MVP để deploy không cần tài khoản S3; khi thư viện ảnh lớn, chuyển sang S3-compatible storage và giữ asset ID. Upload hiện kiểm tra kích thước, chữ ký và MIME; chưa có dịch vụ quét malware hay xử lý lại ảnh.
- Cookie khách 30 ngày; quyền admin hết sau 8 giờ. Xóa cookie sẽ mất quyền truy cập các bài của khách. Mã theo dõi là bí mật; email chỉ để liên hệ, chưa xác minh qua email.
- Chống CSRF bằng kiểm tra Origin chính xác; frontend và API phải cấu hình đúng proxy. Có giới hạn đăng nhập/đóng góp/upload/API, Helmet, cookie HttpOnly/Secure/SameSite, bcrypt, truy vấn tham số hóa. Rate limit lưu trong RAM, phù hợp **một API instance**; nhiều replica cần shared limiter.
- Phiên hết hạn được chấm khi trình duyệt gửi yêu cầu hoặc khi mở lại phiên. Không cần cron cho tính đúng của điểm; chưa có tác vụ nền cập nhật trạng thái các phiên không bao giờ được mở lại.
- Chưa có chức năng chấm tự luận thủ công; câu tự luận được giữ chờ chấm theo phạm vi MVP. Chưa có tài khoản người học/đồng bộ, OCR, lớp học, chấm code hay báo cáo giáo viên.
- Bật backup theo gói Postgres; kiểm tra phục hồi định kỳ. Chỉ mở DB nội bộ trong Blueprint. Dùng Render logs theo dõi health/lỗi; nội dung bài, đáp án, password và token không được đưa vào log API.
- Trước khi phục vụ người dùng thật: cấu hình thời hạn giữ/xóa dữ liệu và thông báo riêng tư phù hợp đơn vị; thiết lập giám sát và backup. Việc này cần thông tin vận hành của chủ hệ thống.

## Cấu trúc

```text
backend/src/domain.js  Schema, trộn, ẩn đáp án và chấm điểm
backend/src/db.js      PostgreSQL schema và transaction
backend/src/app.js     API học tập, đóng góp, ảnh và quản trị
backend/src/seed.js    Nội dung mẫu, tạo admin ban đầu
backend/test/          Kiểm thử domain và API
frontend/src/         Trang học, làm bài, kết quả, đóng góp, admin
frontend/server.js    Server frontend và proxy production
render.yaml           Blueprint Render
compose.yaml          PostgreSQL phát triển cục bộ
```
