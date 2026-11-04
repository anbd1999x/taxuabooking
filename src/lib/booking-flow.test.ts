import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canRoleAct,
  providerCanPay,
  providerCanSetStatus,
  providerCanToggleHeld,
  providerUnlocked,
} from "./booking-flow";

test("providerUnlocked: chỉ mở khoá khi CONFIRMED + đã có cọc", () => {
  assert.equal(providerUnlocked("NEW", "UNPAID"), false);
  assert.equal(providerUnlocked("CONTACTING", "UNPAID"), false);
  assert.equal(providerUnlocked("CONFIRMED", "UNPAID"), false);
  assert.equal(providerUnlocked("CONFIRMED", "DEPOSITED"), true);
  assert.equal(providerUnlocked("CONFIRMED", "PAID"), true);
  assert.equal(providerUnlocked("COMPLETED", "PAID"), false);
});

test("providerCanSetStatus: chỉ hoàn thành đơn đã xác nhận & thu đủ", () => {
  assert.equal(providerCanSetStatus("CONFIRMED", "COMPLETED", "PAID"), true);
  assert.equal(providerCanSetStatus("CONFIRMED", "COMPLETED", "DEPOSITED"), false);
  // Không được tự xác nhận, hủy, hay chạm Mới/Đang liên hệ.
  assert.equal(providerCanSetStatus("NEW", "CONFIRMED", "UNPAID"), false);
  assert.equal(providerCanSetStatus("CONTACTING", "CONFIRMED", "UNPAID"), false);
  assert.equal(providerCanSetStatus("CONFIRMED", "CANCELLED", "DEPOSITED"), false);
});

test("providerCanPay: chỉ thu tiền sau khi đã mở khoá (sàn thu cọc trước)", () => {
  assert.equal(providerCanPay("CONFIRMED", "UNPAID"), false); // chưa có cọc → không được tự ghi cọc
  assert.equal(providerCanPay("NEW", "UNPAID"), false);
  assert.equal(providerCanPay("CONFIRMED", "DEPOSITED"), true); // thu nốt
});

test("providerCanToggleHeld: chỉ sau khi mở khoá", () => {
  assert.equal(providerCanToggleHeld("NEW", "UNPAID"), false);
  assert.equal(providerCanToggleHeld("CONFIRMED", "DEPOSITED"), true);
});

test("canRoleAct: ADMIN toàn quyền", () => {
  assert.equal(canRoleAct("ADMIN", "NEW", "UNPAID", "status", "CONFIRMED"), true);
  assert.equal(canRoleAct("ADMIN", "NEW", "UNPAID", "pay"), true);
  assert.equal(canRoleAct("ADMIN", "CONFIRMED", "DEPOSITED", "status", "CANCELLED"), true);
});

test("canRoleAct: PROVIDER bị chặn ở giai đoạn đầu, mở khoá sau cọc", () => {
  // Mới / Đang liên hệ: không làm gì.
  assert.equal(canRoleAct("PROVIDER", "NEW", "UNPAID", "status", "CONFIRMED"), false);
  assert.equal(canRoleAct("PROVIDER", "CONTACTING", "UNPAID", "status", "CONFIRMED"), false);
  assert.equal(canRoleAct("PROVIDER", "CONFIRMED", "UNPAID", "pay"), false); // chưa có cọc
  // Sau khi sàn ghi cọc: thu nốt, giữ phòng, hoàn thành (khi đã thu đủ).
  assert.equal(canRoleAct("PROVIDER", "CONFIRMED", "DEPOSITED", "pay"), true);
  assert.equal(canRoleAct("PROVIDER", "CONFIRMED", "DEPOSITED", "held"), true);
  assert.equal(canRoleAct("PROVIDER", "CONFIRMED", "DEPOSITED", "status", "COMPLETED"), false); // chưa thu đủ
  assert.equal(canRoleAct("PROVIDER", "CONFIRMED", "PAID", "status", "COMPLETED"), true);
  assert.equal(canRoleAct("PROVIDER", "CONFIRMED", "PAID", "status", "CANCELLED"), false); // không được hủy
});

test("canRoleAct: CTV không có quyền", () => {
  assert.equal(canRoleAct("CTV", "CONFIRMED", "PAID", "status", "COMPLETED"), false);
  assert.equal(canRoleAct("CTV", "CONFIRMED", "DEPOSITED", "pay"), false);
});
