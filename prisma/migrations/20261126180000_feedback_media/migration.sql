-- Góp ý: nhiều ảnh / video đính kèm (url /uploads/gopy-…); cột screenshot cũ vẫn giữ cho góp ý trước đây.
ALTER TABLE "Feedback" ADD COLUMN "media" TEXT[] DEFAULT ARRAY[]::TEXT[];
