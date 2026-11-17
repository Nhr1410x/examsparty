# Bản thiết kế hệ thống ôn tập và thi trắc nghiệm

**Phiên bản:** 1.0  
**Mục tiêu:** Xây dựng kho câu hỏi và đề thi có thể dùng ngay không cần đăng nhập, đồng thời cho phép người dùng đóng góp nội dung để quản trị viên duyệt.

## 1. Tóm tắt sản phẩm

Hệ thống có hai khu vực chính:

- **Khu vực học tập công khai:** tìm đề, luyện tập theo câu hỏi, thi thử có thời gian, xem kết quả.
- **Khu vực quản trị:** đăng nhập để quản lý câu hỏi, đề thi, nội dung chờ duyệt, tài khoản và cấu hình cốt lõi.

Khách có thể duyệt và làm bài không cần tài khoản. Để có lịch sử học tập đồng bộ và theo dõi tiến độ qua nhiều thiết bị, người học có thể tạo tài khoản ở giai đoạn sau. Người đóng góp đề cần đăng nhập tối giản để admin có thể liên hệ, xem trạng thái gửi và xử lý spam; nếu muốn giữ trải nghiệm hoàn toàn ẩn danh, có thể cho gửi không tài khoản nhưng vẫn cần email xác nhận hoặc mã theo dõi.

## 2. Mục tiêu và ngoài phạm vi MVP

### MVP cần có

1. Duyệt, tìm kiếm và lọc kho câu hỏi/đề.
2. Luyện tập không giới hạn, không trộn câu, hiện đáp án và lời giải sau khi trả lời; lưu tạm tiến độ để tiếp tục.
3. Thi thử có thời gian, trộn câu và phương án, tự nộp khi hết giờ.
4. Chấm điểm quy đổi thang 10, tổng hợp đúng/sai/bỏ trống và cho xem lại từng câu.
5. Gửi đề/câu hỏi mới ở trạng thái chờ duyệt; admin duyệt, từ chối hoặc yêu cầu chỉnh sửa.
6. Admin nhập câu hỏi bằng biểu mẫu hoặc tải tệp JSON; admin có thể xuất bản trực tiếp.
7. Câu hỏi hỗ trợ văn bản, ảnh, công thức, đoạn mã, nhiều phương án và nhiều dạng trả lời.

### Để giai đoạn sau

- Ngân hàng đề thích ứng theo năng lực, đề xuất câu yếu cần ôn lại.
- Tài khoản người học, đồng bộ nhiều thiết bị, bảng xếp hạng và huy hiệu.
- Nhập Word/PDF/Excel có OCR; nhập từ Google Forms.
- Thi theo lớp/nhóm, giao bài tập, báo cáo cho giáo viên.
- Soạn thảo cộng tác, phiên bản hóa nội dung nâng cao.

## 3. Vai trò và quyền hạn

| Vai trò | Quyền |
|---|---|
| Khách | Xem nội dung đã xuất bản, luyện tập/thi thử, tìm kiếm, xem kết quả của phiên hiện tại. |
| Người đóng góp | Các quyền của khách; gửi câu hỏi hoặc đề để duyệt; xem trạng thái các nội dung mình gửi. |
| Admin | Duyệt/từ chối/yêu cầu sửa; tạo và sửa nội dung; xuất bản trực tiếp; quản lý tài khoản và cấu hình; xem nhật ký thao tác. |

Không dùng nút hoặc cờ ở trình duyệt để xác định quyền admin. Quyền phải được xác thực và kiểm tra ở máy chủ cho từng API.

## 4. Sơ đồ trang và điều hướng

### Phần người học

- **Trang chủ:** ô tìm kiếm, môn học/chủ đề, đề mới/cập nhật, nút “Luyện tập” và “Thi thử”.
- **Kho câu hỏi/đề:** lọc theo môn, lớp, chủ đề, mức độ, dạng câu hỏi, thời lượng và số câu.
- **Chi tiết đề:** mô tả, số câu, thời gian, thang điểm, quy tắc trộn; chọn chế độ.
- **Màn hình làm bài:** câu hiện tại, nội dung và phương án, điều hướng câu, bộ đếm thời gian trong thi thử.
- **Kết quả:** điểm thang 10, đúng/sai/bỏ trống, thời gian làm, xem lại, tìm câu hỏi.
- **Đóng góp nội dung:** nhập biểu mẫu hoặc tải JSON, xem trước, gửi duyệt, theo dõi trạng thái.

### Phần quản trị

- **Đăng nhập admin** (đường dẫn riêng, có giới hạn thử đăng nhập và MFA khi triển khai thật).
- **Tổng quan:** nội dung chờ duyệt, đề/câu hỏi mới, báo cáo lỗi, số lượt làm.
- **Hàng đợi duyệt:** xem trước như người học; duyệt, từ chối với lý do, hoặc yêu cầu sửa.
- **Quản lý câu hỏi:** tìm, lọc, sửa, lưu nháp, xuất bản, lưu trữ.
- **Quản lý đề:** tạo đề, thêm/sắp xếp câu, cấu hình thời gian và cách tính điểm.
- **Quản lý người dùng:** tìm tài khoản, khóa/mở khóa, vai trò, trạng thái gửi bài. Không cho sửa/xem mật khẩu.
- **Nhật ký và cấu hình:** lịch sử thay đổi, môn/chủ đề, chính sách gửi nội dung.

## 5. Luồng nghiệp vụ

### 5.1. Luyện tập

1. Người học chọn chủ đề hoặc đề, bấm “Luyện tập”.
2. Hệ thống giữ thứ tự mặc định; không trộn câu/phương án.
3. Người học trả lời và bấm “Kiểm tra” hoặc chọn phương án nếu cấu hình tự kiểm tra.
4. Hiện đúng/sai, đáp án chuẩn và lời giải ngay sau câu trả lời.
5. Lưu tiến độ tự động sau mỗi câu. Khách lưu bằng trình duyệt hiện tại; tài khoản có thể đồng bộ máy chủ.
6. Người học có thể tạm dừng, quay lại, tiếp tục hoặc kết thúc sớm.
7. Kết thúc thì hiện thống kê và chế độ xem lại.

Nên có thao tác “Đánh dấu cần ôn lại” và “Bỏ qua câu” nhưng không bắt buộc.

### 5.2. Thi thử

1. Hiện xác nhận trước khi bắt đầu: số câu, thời gian, quy tắc trộn và cách tính điểm.
2. Khi bắt đầu, máy chủ tạo một phiên thi với thứ tự câu/phương án đã trộn và mốc hết giờ.
3. Đồng hồ hiển thị; tự lưu câu trả lời định kỳ và khi chuyển câu.
4. Không có nút tạm dừng. Làm mới trang thì phục hồi phiên đang chạy nếu chưa hết giờ.
5. Hết giờ thì tự nộp; nếu rời trang trước đó, phiên vẫn hết hạn theo đồng hồ phía máy chủ.
6. Sau khi nộp, chấm câu tự động; câu tự luận được đánh dấu cần chấm nếu chưa có rubric/chấm tự động được kiểm chứng.

Trộn câu/phương án phải được tạo và giữ cố định cho từng phiên, không tạo lại mỗi lần tải trang. Câu đúng/sai nên trộn thứ tự câu nhưng không đổi nhãn đúng/sai.

### 5.3. Đóng góp và duyệt

1. Người dùng nhập đề bằng biểu mẫu hoặc tải JSON.
2. Hệ thống kiểm tra cấu trúc, báo lỗi theo dòng/câu, hiển thị bản xem trước và yêu cầu xác nhận.
3. Khi gửi, tạo bản ghi `pending`; nội dung chưa xuất hiện trong kho công khai.
4. Admin mở hàng đợi và xem nội dung, đáp án, giải thích, tệp đính kèm và cảnh báo trùng lặp.
5. Admin duyệt, từ chối kèm lý do, hoặc yêu cầu người gửi chỉnh sửa.
6. Khi duyệt, nội dung được tạo thành phiên bản đã xuất bản; ghi lại người duyệt, thời gian và phiên bản nguồn.

## 6. Dạng câu hỏi và cách chấm

Mỗi câu có trường `type`, không suy ra kiểu câu từ số lượng đáp án.

| Dạng | Nội dung nhập | Chấm điểm MVP |
|---|---|---|
| `single_choice` | Chọn một trong N phương án | Tự động, đúng/sai. |
| `multiple_choice` | Chọn nhiều phương án | Tự động; mặc định chỉ đúng khi tập chọn khớp hoàn toàn. Cho phép cấu hình điểm từng phần. |
| `true_false` | Một nhận định đúng hoặc sai; có thể nhóm nhiều nhận định | Tự động theo từng nhận định. |
| `short_answer` | Nhập đáp án ngắn | So khớp chuẩn hóa với một hoặc nhiều đáp án; cho phép dung sai số nếu là câu số học. |
| `essay` | Ô nhập văn bản dài | Chưa chấm tự động trong MVP; lưu câu trả lời để giáo viên/admin chấm theo rubric. |
| `code` (mở rộng) | Trình soạn thảo mã và ngôn ngữ | Giai đoạn sau mới chạy chấm bằng sandbox cô lập; không chạy mã trực tiếp trên máy chủ ứng dụng. |

MVP có thể hỗ trợ `single_choice`, `multiple_choice`, `true_false`, `short_answer`, `essay`. Các dạng có cấu trúc như nối cặp, điền khuyết, sắp xếp thứ tự và câu gồm nhiều ý nên thêm sau khi có nhu cầu thực tế.

## 7. Định dạng nhập đề: JSON

Chọn JSON làm định dạng chuẩn đầu tiên vì có cấu trúc rõ, dễ kiểm tra bằng schema và được hỗ trợ rộng trong trình duyệt, Python, Node và các công cụ khác. YAML dễ đọc hơn với một số người nhưng thụt lề dễ gây lỗi; có thể hỗ trợ chuyển YAML sang JSON ở phiên bản sau. Cung cấp file mẫu tải về, hướng dẫn ngắn và trình kiểm tra trước khi gửi.

Ví dụ một tệp đề:

```json
{
  "schema_version": "1.0",
  "title": "Ôn tập chương 1",
  "subject": "Toán học",
  "grade": "10",
  "topics": ["Mệnh đề"],
  "description": "Bộ câu hỏi ôn tập chương 1",
  "settings": {
    "time_limit_minutes": 30,
    "shuffle_questions": true,
    "shuffle_options": true,
    "score_scale": 10
  },
  "questions": [
    {
      "client_id": "q1",
      "type": "single_choice",
      "prompt": [{"type": "text", "value": "Mệnh đề nào sau đây là đúng?"}],
      "options": [
        {"id": "a", "content": [{"type": "text", "value": "..."}]},
        {"id": "b", "content": [{"type": "text", "value": "..."}]},
        {"id": "c", "content": [{"type": "text", "value": "..."}]},
        {"id": "d", "content": [{"type": "text", "value": "..."}]},
        {"id": "e", "content": [{"type": "text", "value": "Phương án thứ năm nếu cần"}]}
      ],
      "answer": {"correct_option_ids": ["c"]},
      "explanation": [{"type": "text", "value": "Giải thích ngắn gọn vì sao C đúng."}],
      "points": 1,
      "difficulty": "medium",
      "tags": ["chuong-1", "menh-de"]
    },
    {
      "client_id": "q2",
      "type": "true_false",
      "prompt": [{"type": "text", "value": "Xét các khẳng định sau."}],
      "statements": [
        {"id": "s1", "content": [{"type": "text", "value": "Khẳng định thứ nhất."}], "answer": true},
        {"id": "s2", "content": [{"type": "text", "value": "Khẳng định thứ hai."}], "answer": false}
      ],
      "explanation": [{"type": "text", "value": "Giải thích từng khẳng định."}],
      "points": 2
    },
    {
      "client_id": "q3",
      "type": "short_answer",
      "prompt": [{"type": "text", "value": "Tính 2 + 2."}],
      "answer": {"accepted": ["4", "bốn"], "case_sensitive": false},
      "explanation": [{"type": "text", "value": "2 + 2 = 4."}],
      "points": 1
    }
  ]
}
```

### Quy ước nội dung đa phương tiện

Trường `prompt`, `options`, `explanation` dùng danh sách khối nội dung thay vì một chuỗi HTML tự do. Khối ban đầu nên hỗ trợ:

- `text`: văn bản thuần/Markdown được lọc an toàn.
- `image`: tệp ảnh đã tải lên, lưu bằng `asset_id`, có mô tả thay thế.
- `math`: công thức LaTeX, ví dụ `x^2 + 1`.
- `code`: văn bản mã và tên ngôn ngữ; chỉ hiển thị, không thực thi.

Không cho phép HTML/JavaScript tùy ý trong JSON. Cần giới hạn dung lượng, loại MIME, số lượng ảnh và kiểm tra tệp tải lên.

### Kiểm tra JSON trước khi lưu

- Có `schema_version`, tiêu đề, danh sách câu không rỗng.
- Mỗi câu có `client_id` duy nhất, `type` hợp lệ, nội dung và điểm không âm.
- Câu lựa chọn có tối thiểu hai phương án và đáp án tham chiếu đúng `id`.
- Câu đúng/sai có đáp án cho mọi nhận định.
- Câu trả lời ngắn có ít nhất một đáp án chấp nhận.
- Thời gian thi lớn hơn 0 nếu bật chế độ thi.
- Từ chối trường không hỗ trợ hoặc hiển thị cảnh báo rõ; không âm thầm bỏ nội dung.
- Cho tải xuống lỗi xác thực theo số câu và trường bị lỗi.

## 8. Giao diện chính

### Màn hình làm bài

- Phần đầu: tên đề, tiến độ `5/20`, nút thoát/lưu và thời gian còn lại khi thi.
- Phần nội dung: câu hỏi, ảnh/công thức/mã, phương án có thể truy cập bằng bàn phím.
- Phần điều hướng: trước/sau, danh sách số câu; trạng thái chưa làm/đã trả lời/đánh dấu.
- Luyện tập: nút kiểm tra và khung phản hồi dưới câu.
- Thi thử: nút nộp bài, cảnh báo câu chưa trả lời và hộp xác nhận.

### Màn hình kết quả

- Điểm: `điểm = điểm đạt / tổng điểm × 10`, làm tròn mặc định đến 2 chữ số.
- Số đúng, sai, bỏ trống; thời lượng; biểu đồ theo chủ đề nếu đề có gắn chủ đề.
- Bộ lọc: tất cả, sai, bỏ trống, đúng; ô tìm kiếm theo nội dung câu.
- Mỗi câu có lựa chọn của người học, đáp án chuẩn, lời giải và điểm đạt.
- Với câu tự luận, hiển thị “chưa chấm” thay vì tính sai; điểm tổng chỉ là tạm tính đến khi chấm xong.

Không đưa đáp án chuẩn vào mã nguồn công khai trước khi nộp bài thi. API làm bài thi chỉ trả câu hỏi và phương án; endpoint nộp bài mới chấm ở máy chủ.

## 9. Mô hình dữ liệu đề xuất

| Bảng/đối tượng | Trường cốt lõi |
|---|---|
| `users` | id, email, password_hash, role, status, created_at |
| `questions` | id, type, content_json, answer_key_json (riêng tư), explanation_json, points, difficulty, status, author_id, version |
| `exams` | id, title, description, subject, grade, settings_json, status, author_id, published_version |
| `exam_questions` | exam_id, question_id, position, points_override |
| `submissions` | id, author_id hoặc guest_contact, content_json, status, reviewer_id, review_note, created_at |
| `assets` | id, storage_key, mime_type, size, checksum, alt_text, owner_id |
| `attempts` | id, exam_id, user_id/session_id, mode, started_at, expires_at, submitted_at, order_json, status |
| `answers` | attempt_id, question_id, response_json, awarded_points, grading_status |
| `audit_logs` | actor_id, action, target_type, target_id, before/after summary, created_at |

Lưu `content_json` để hỗ trợ đa phương tiện linh hoạt; các trường phục vụ lọc như môn, lớp, trạng thái và dạng câu hỏi vẫn nên là cột có chỉ mục. Không trả `answer_key_json` cho trình duyệt trước khi được phép.

## 10. API khung

### Công khai

- `GET /api/exams` — tìm đề đã xuất bản, lọc và phân trang.
- `GET /api/exams/{id}` — chi tiết đề, không gồm đáp án bí mật.
- `GET /api/questions` — tìm câu hỏi đã xuất bản.
- `POST /api/attempts` — bắt đầu phiên luyện tập/thi thử.
- `PUT /api/attempts/{id}/answers/{questionId}` — lưu câu trả lời.
- `POST /api/attempts/{id}/submit` — nộp và chấm các câu tự động.
- `POST /api/contributions` — gửi nội dung chờ duyệt.
- `POST /api/uploads` — tải ảnh lên theo chính sách.

### Quản trị (yêu cầu vai trò admin)

- `GET /api/admin/review-queue`
- `POST /api/admin/submissions/{id}/approve`
- `POST /api/admin/submissions/{id}/reject`
- `POST /api/admin/submissions/{id}/request-changes`
- CRUD `/api/admin/questions`, `/api/admin/exams`, `/api/admin/users`
- `GET /api/admin/audit-logs`

Các API cần xác thực đầu vào, phân trang, giới hạn tốc độ và trả lỗi có cấu trúc. Endpoint duyệt/xuất bản cần ghi audit log.

## 11. Công nghệ tham khảo

Chọn một bộ công nghệ quen thuộc với nhóm triển khai, không khóa thiết kế vào một nhà cung cấp:

- **Frontend:** Next.js + TypeScript, giao diện responsive, hỗ trợ bàn phím và đọc màn hình.
- **Backend:** API trong Next.js cho MVP hoặc NestJS nếu tách backend rõ ràng.
- **Cơ sở dữ liệu:** PostgreSQL; JSONB cho khối nội dung và đáp án có cấu trúc.
- **ORM:** Prisma hoặc Drizzle.
- **Lưu ảnh:** object storage tương thích S3, lưu metadata trong PostgreSQL.
- **Xác thực admin:** phiên cookie `HttpOnly`, `Secure`, `SameSite`; mật khẩu băm bằng Argon2id/bcrypt; bật MFA khi có thể.
- **Triển khai:** dịch vụ có HTTPS, sao lưu cơ sở dữ liệu, log lỗi và môi trường staging riêng.

Nếu ưu tiên làm nhanh với ít vận hành, có thể dùng dịch vụ managed PostgreSQL/auth/storage; vẫn phải bảo đảm quy tắc truy cập server-side và không để khóa bí mật ở frontend.

## 12. Bảo mật, quyền riêng tư và vận hành

- Người học không cần đăng nhập để xem và làm bài; chỉ thu dữ liệu tối thiểu.
- Tài khoản admin được mời/tạo bởi chủ hệ thống, không có tự đăng ký admin.
- Phân quyền theo vai trò ở backend; kiểm tra quyền trên từng thao tác sửa/xóa/duyệt.
- Bảo vệ CSRF cho phiên cookie, chống XSS bằng lọc Markdown và escape nội dung, dùng prepared queries/ORM.
- Giới hạn tốc độ đăng nhập, upload và gửi đóng góp; CAPTCHA chỉ bật khi phát hiện lạm dụng.
- Xác thực MIME và kích thước ảnh; đổi tên tệp; quét tệp nếu hạ tầng hỗ trợ; không phục vụ SVG/HTML tải lên như nội dung thực thi.
- Không ghi mật khẩu, token, đáp án thi hoặc dữ liệu nhạy cảm vào log.
- Có sao lưu định kỳ, phục hồi thử nghiệm, chính sách lưu/xóa dữ liệu và thông báo quyền riêng tư.
- Nội dung người dùng gửi được xem là không tin cậy; admin xem trước trong chế độ an toàn.

## 13. Yêu cầu phi chức năng

- Hoạt động tốt trên điện thoại, máy tính bảng và máy tính.
- Tìm kiếm có phân trang; không tải toàn bộ kho câu hỏi cùng lúc.
- Màn hình làm bài phản hồi nhanh, lưu tự động và phục hồi sau tải lại.
- Hiển thị trạng thái rõ: đang lưu, đã lưu, mất kết nối, nộp thành công.
- Tương phản đủ, điều hướng bàn phím, nhãn cho ảnh, trạng thái không chỉ dựa vào màu sắc.
- Theo dõi lỗi API, lỗi frontend, thời gian phản hồi và các thao tác quản trị quan trọng.

## 14. Quy tắc điểm và trường hợp biên

- Tổng điểm đề là tổng điểm câu, hoặc dùng trọng số được admin cấu hình.
- Điểm thang 10 = `10 × điểm đạt / tổng điểm`; đề rỗng hoặc tổng điểm bằng 0 bị từ chối khi xuất bản.
- Câu bỏ trống được 0 điểm trong MVP; không trừ điểm câu sai trừ khi đề bật cấu hình.
- Với nhiều lựa chọn, mặc định chấm chính xác toàn bộ; nếu điểm từng phần, phải quy định rõ có trừ điểm chọn thừa hay không.
- Câu số học chuẩn hóa khoảng trắng/dấu phẩy thập phân theo cấu hình; không dùng so khớp gần đúng chung cho mọi câu.
- Nếu phiên thi hết giờ, máy chủ chấm các câu đã lưu gần nhất; hiển thị rõ nếu câu trả lời cuối chưa đồng bộ.
- Nếu admin sửa đề sau khi người học đã bắt đầu, phiên đang làm tiếp tục theo phiên bản đã chụp lúc bắt đầu.
- Khi xóa câu đã dùng trong đề/lịch sử, ưu tiên lưu trữ thay vì xóa vật lý để giữ kết quả cũ.

## 15. Lộ trình thực hiện

### Giai đoạn 1 — MVP học tập

- Khung giao diện công khai, kho đề, tìm kiếm cơ bản.
- Dạng câu hỏi lựa chọn một/nhiều, đúng-sai, trả lời ngắn, tự luận.
- Luyện tập và thi thử; lưu phiên; chấm tự động; trang kết quả.

### Giai đoạn 2 — Đóng góp và quản trị

- Đăng nhập admin, hàng đợi duyệt, quản lý đề/câu hỏi/người dùng.
- Form nhập câu hỏi, upload ảnh, nhập JSON có kiểm tra và xem trước.
- Audit log, báo lỗi nội dung, chống spam.

### Giai đoạn 3 — Tài khoản người học và chất lượng

- Đăng ký/đăng nhập người học tùy nhu cầu; đồng bộ lịch sử và tiến độ.
- Đánh dấu câu, thống kê theo chủ đề, ôn lại câu sai.
- Nhập/xuất nâng cao, nhập hàng loạt, phiên bản đề và khôi phục.

### Giai đoạn 4 — Mở rộng

- Lớp học/giao bài, ngân hàng câu hỏi thích ứng, báo cáo giáo viên.
- Chấm tự luận theo rubric có xác nhận của người chấm.
- Chấm mã trong sandbox riêng, nếu sản phẩm thực sự cần.

## 16. Tiêu chí nghiệm thu MVP

1. Khách mở kho đề, tìm kiếm, bắt đầu và hoàn tất bài mà không đăng nhập.
2. Luyện tập giữ thứ tự, hiện lời giải sau khi trả lời và khôi phục được tiến độ trên cùng trình duyệt.
3. Thi thử trộn câu/phương án một lần cho mỗi phiên, không cho tạm dừng, tự nộp đúng giờ và không lộ đáp án trước khi nộp.
4. Kết quả hiển thị đúng điểm thang 10, số câu đúng/sai/bỏ trống và cho lọc/tìm trong phần xem lại.
5. Người dùng gửi JSON hợp lệ thì tạo nội dung `pending`; JSON sai có thông báo chỉ rõ câu và trường.
6. Người không có quyền admin không thể gọi API duyệt, sửa nội dung đã xuất bản hoặc quản lý tài khoản.
7. Admin duyệt/từ chối/yêu cầu sửa được; mọi quyết định có người thực hiện và thời điểm.
8. Ảnh, công thức, code block và hơn bốn phương án hiển thị đúng trên điện thoại và máy tính.

## 17. Các quyết định nên chốt trước khi bắt đầu lập trình

- Người gửi đề có cần tài khoản hay dùng email/mã theo dõi? Khuyến nghị: đọc và làm bài không cần tài khoản; gửi đề cần tài khoản nhẹ hoặc email xác minh.
- Một đề có thể chứa nhiều môn/chủ đề không? Khuyến nghị: một môn/lớp chính, nhiều tag/chủ đề.
- Có chấm điểm từng phần cho câu nhiều lựa chọn không? Khuyến nghị: tắt mặc định, bật theo từng câu khi admin cấu hình.
- Câu tự luận có được tính điểm ngay không? Khuyến nghị: không; để trạng thái chờ chấm.
- Câu hỏi có thể dùng lại trong nhiều đề không? Khuyến nghị: có, qua ngân hàng câu hỏi và bảng liên kết đề-câu.
- MVP có cần đăng ký tài khoản người học không? Khuyến nghị: chưa cần; ưu tiên hoàn thiện luồng khách và quản trị.

**Khuyến nghị phạm vi triển khai đầu tiên:** làm kho đề công khai, luyện tập/thi thử, kết quả, gửi đóng góp JSON, admin duyệt và quản lý nội dung. Giữ đăng ký người học, lớp học, chấm code và OCR cho giai đoạn sau để hệ thống sớm dùng được mà không tăng độ phức tạp ban đầu.

## 18. Định hướng giao diện và màu sắc

### Nguyên tắc hình ảnh

- Màu xanh lá là màu nhận diện chính, gợi cảm giác học tập và tiến bộ; dùng cho nút hành động chính, liên kết quan trọng, trạng thái đang chọn và điểm nhấn thương hiệu.
- Giao diện ưu tiên sáng, thoáng, dễ đọc; tránh phủ xanh toàn bộ nền hoặc dùng xanh lá cho mọi thành phần.
- Dùng cùng một hệ thống màu cho trang người học và trang admin; trang admin có thể dày thông tin hơn nhưng không đổi ngôn ngữ giao diện.
- Màu trạng thái đúng/sai cần đi kèm biểu tượng và nhãn chữ, không chỉ dựa vào màu.

### Bảng màu đề xuất

| Vai trò | Light mode | Dark mode |
|---|---|---|
| Nền trang | `#F7FAF7` | `#101713` |
| Bề mặt thẻ/nội dung | `#FFFFFF` | `#18221C` |
| Bề mặt phụ | `#EEF5EF` | `#202D24` |
| Xanh chính | `#16803C` | `#55C878` |
| Xanh đậm khi hover | `#11652F` | `#78D992` |
| Văn bản chính | `#18231B` | `#E8F1EA` |
| Văn bản phụ | `#5B6B5F` | `#A9B8AC` |
| Viền | `#DCE7DE` | `#34443A` |
| Đúng/thành công | `#187A3D` | `#6BD18A` |
| Sai/lỗi | `#B42332` | `#FF7B83` |
| Cảnh báo | `#9A6700` | `#F2C15D` |

Đây là bộ màu khởi điểm; khi triển khai cần kiểm tra tương phản chữ/nút theo WCAG AA, nhất là chữ trắng trên nền xanh và màu phụ trong dark mode. Màu xanh chính dùng vừa đủ để tạo điểm nhấn; nền đọc câu hỏi nên trung tính để giảm mỏi mắt.

### Chuyển Light/Dark mode

- Có nút chuyển chế độ ở thanh điều hướng, thể hiện bằng biểu tượng mặt trời/mặt trăng và nhãn trợ năng như “Chuyển sang giao diện tối/sáng”.
- Lựa chọn mặc định theo thiết lập hệ điều hành (`system`); sau khi người dùng tự chọn Light hoặc Dark, ghi nhớ lựa chọn trong `localStorage` cho khách và trong hồ sơ tài khoản khi có đăng nhập.
- Áp dụng cùng chế độ cho toàn bộ trang, hộp thoại, biểu mẫu, biểu đồ, vùng công thức và trình xem code; tránh để một thành phần bị sáng chói hoặc sai màu trong dark mode.
- Chuyển màu êm trong thời gian ngắn, nhưng tôn trọng `prefers-reduced-motion`; không nháy trắng khi tải trang hoặc khôi phục chế độ.
- Khi đổi chế độ trong lúc đang làm bài, không làm mất câu trả lời, vị trí câu hay trạng thái bộ đếm giờ.

### Thành phần giao diện cần thống nhất

- Nút chính dùng xanh lá; nút phụ có nền trung tính; thao tác nguy hiểm như xóa hoặc khóa tài khoản dùng màu cảnh báo riêng.
- Thanh tiến độ bài làm và trạng thái câu dùng xanh lá cùng nhãn trạng thái; câu sai dùng màu lỗi, câu chưa làm dùng màu trung tính.
- Thẻ đề, bộ lọc, ô tìm kiếm, trường nhập liệu, bảng admin và hộp xác nhận có biến thể Light/Dark đầy đủ.
- Khi xem đáp án, khung phản hồi đúng/sai có màu nền nhẹ, biểu tượng và giải thích bằng chữ; không dùng nền màu đậm phủ toàn khung.
- Tất cả trạng thái focus bàn phím phải nhìn thấy rõ ở cả hai chế độ.

### Tiêu chí nghiệm thu giao diện

1. Người dùng đổi qua lại giữa Light và Dark từ mọi trang chính.
2. Chế độ đã chọn được giữ sau khi tải lại và điều hướng giữa các trang; lần đầu dùng sẽ theo hệ điều hành.
3. Nội dung, đáp án, biểu đồ, ảnh, công thức, code block và vùng admin đều đọc được ở cả hai chế độ.
4. Không mất tiến độ luyện tập/thi thử khi chuyển chế độ.
5. Văn bản, trạng thái đúng/sai, focus và điều khiển có tương phản phù hợp; trạng thái không chỉ phân biệt bằng màu.
