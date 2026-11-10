import { Prisma } from "@prisma/client";

/**
 * Lỗi hạ tầng (Prisma/DB…) KHÔNG được trả nguyên văn cho khách — thông điệp chứa tên bảng,
 * câu lệnh, cấu trúc dữ liệu. Lỗi nghiệp vụ (`throw new Error("...")` trong booking/cabin/combo)
 * vẫn trả nguyên để khách biết lý do (ngày đã qua, phòng không hợp lệ…).
 */
export function isInternalError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  );
}
