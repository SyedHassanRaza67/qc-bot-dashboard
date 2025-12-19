-- Add agent_response and customer_response columns to call_records
ALTER TABLE public.call_records 
ADD COLUMN agent_response TEXT CHECK (agent_response IN ('very-bad', 'bad', 'average', 'good', 'excellent')),
ADD COLUMN customer_response TEXT CHECK (customer_response IN ('very-bad', 'bad', 'average', 'good', 'excellent'));