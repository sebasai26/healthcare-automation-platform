-- Add missing columns to balance_mensual table
ALTER TABLE public.balance_mensual 
ADD COLUMN IF NOT EXISTS fecha text,
ADD COLUMN IF NOT EXISTS efectivo numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tarjeta numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS talon_transferencia numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bono_regalo numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS domiciliacion numeric DEFAULT 0;