-- CreateTable
CREATE TABLE "eval_attendance_records" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "grade" TEXT,
    "gender" TEXT,
    "school" TEXT,
    "guardian_name" TEXT,
    "guardian_email" TEXT,
    "guardian_phone" TEXT,
    "notes" TEXT,
    "matched_athlete_id" TEXT,
    "matched_at" TIMESTAMP(3),
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "eval_attendance_records_matched_athlete_id_key" ON "eval_attendance_records"("matched_athlete_id");

-- AddForeignKey
ALTER TABLE "eval_attendance_records" ADD CONSTRAINT "eval_attendance_records_matched_athlete_id_fkey" FOREIGN KEY ("matched_athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
