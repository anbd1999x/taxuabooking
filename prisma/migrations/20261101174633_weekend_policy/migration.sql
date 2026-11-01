-- CreateEnum
CREATE TYPE "WeekendPolicy" AS ENUM ('NONE', 'FRI_SAT', 'SAT_SUN', 'FRI_SUN');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "weekendPolicy" "WeekendPolicy" NOT NULL DEFAULT 'NONE';

