-- Pharmacy delivery fee (payable with reward coins)
ALTER TABLE "PharmacyProfile" ADD COLUMN "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "PharmacyOrder" ADD COLUMN "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0;
