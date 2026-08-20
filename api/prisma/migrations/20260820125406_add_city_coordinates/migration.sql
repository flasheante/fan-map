-- AlterTable
ALTER TABLE "cities" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CheckConstraint: latitude must be within [-90, 90] when provided
ALTER TABLE "cities" ADD CONSTRAINT "cities_latitude_range"
    CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90));

-- CheckConstraint: longitude must be within [-180, 180] when provided
ALTER TABLE "cities" ADD CONSTRAINT "cities_longitude_range"
    CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180));
