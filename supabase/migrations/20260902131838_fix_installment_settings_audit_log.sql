-- Fix: audit_logs.entity_id is uuid, but update_installment_settings inserts integer 0
CREATE OR REPLACE FUNCTION public.update_installment_settings(p_settings jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_item jsonb;
v_count integer;
v_active boolean;
v_interest numeric;
v_commission numeric;
BEGIN
IF NOT public.is_admin() THEN
RAISE EXCEPTION 'Yetkisiz islem';
END IF;

FOR v_item IN SELECT * FROM jsonb_array_elements(p_settings)
LOOP
v_count := (v_item->>'installment_count')::integer;
v_active := (v_item->>'is_active')::boolean;
v_interest := COALESCE((v_item->>'interest_rate')::numeric, 0);
v_commission := COALESCE((v_item->>'commission_rate')::numeric, 0.0099);

UPDATE public.installment_settings
SET is_active = v_active,
interest_rate = v_interest,
commission_rate = v_commission,
updated_at = now()
WHERE installment_count = v_count;
END LOOP;

INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description)
VALUES (auth.uid(), 'UPDATE_INSTALLMENT', 'INSTALLMENT_SETTINGS', NULL, 'Taksit ayarlari guncellendi');
END;
$function$;
