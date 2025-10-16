-- Add missing ride_type column to fix schema error
ALTER TABLE public.ride_hailing_bookings 
ADD COLUMN ride_type VARCHAR(50) DEFAULT 'standard';

-- Create index for ride_type for better performance
CREATE INDEX IF NOT EXISTS idx_rh_ride_type 
ON public.ride_hailing_bookings USING btree (ride_type);

-- Update existing records to have default ride_type
UPDATE public.ride_hailing_bookings 
SET ride_type = 'standard' 
WHERE ride_type IS NULL;