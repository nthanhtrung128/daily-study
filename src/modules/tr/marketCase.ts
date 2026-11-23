// Dữ liệu giả định dùng xuyên suốt tình huống đối sánh và trình bày với CFO.
export const marketRole = 'Trưởng nhóm tiền lương tại Hà Nội. Người này phân công ba chuyên viên, kiểm soát bảng lương cho 600 nhân viên tại một nhà máy và xử lý sai lệch trước khi trình ký. Giám đốc nhân sự duyệt chính sách và ngân sách.';
export const marketProfiles = [
  { id: 'A', title: 'Trưởng nhóm tiền lương', scope: 'Phụ trách bốn nhà máy, quản lý hai trưởng nhóm và có quyền duyệt ngân sách.', median: 48, age: 2, employers: 26,
    feedback: 'Tên chức danh trùng, nhưng quản lý nhiều nhà máy và duyệt ngân sách là trách nhiệm lớn hơn vị trí nội bộ.' },
  { id: 'B', title: 'Giám sát vận hành payroll', scope: 'Điều phối ba chuyên viên tại một nhà máy, kiểm soát kết quả và trình cấp trên phê duyệt.', median: 36, age: 12, employers: 18,
    feedback: 'Phạm vi một nhà máy, trách nhiệm kiểm soát và quyền trình duyệt đều phù hợp. Dữ liệu đã 12 tháng. Hãy xác minh mức dịch chuyển thị trường và thành phần mẫu trước khi dùng P50.' },
  { id: 'C', title: 'Chuyên viên payroll cao cấp', scope: 'Tự xử lý các kỳ lương phức tạp, không quản lý nhóm và chỉ chịu trách nhiệm về phần việc cá nhân.', median: 30, age: 1, employers: 32,
    feedback: 'Mẫu mới và P50 thấp hơn nhưng đây là chuyên viên cá nhân. Dùng mức này sẽ bỏ sót trách nhiệm điều phối và kiểm soát của trưởng nhóm.' },
] as const;
