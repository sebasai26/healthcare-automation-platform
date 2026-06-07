CREATE TABLE IF NOT EXISTS public.sugerencias_guardadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    objetivo TEXT NOT NULL,
    hoja_ruta TEXT NOT NULL,
    topic TEXT NOT NULL,
    fecha_guardado TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sugerencias_guardadas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own saved suggestions" 
ON public.sugerencias_guardadas FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved suggestions" 
ON public.sugerencias_guardadas FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved suggestions" 
ON public.sugerencias_guardadas FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved suggestions" 
ON public.sugerencias_guardadas FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
