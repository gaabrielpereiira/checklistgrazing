
CREATE OR REPLACE FUNCTION public.handle_new_collection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.columns (name, position, collection_id) VALUES
    ('A Fazer', 0, NEW.id),
    ('Em Progresso', 1, NEW.id),
    ('Concluído', 2, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_collection_created
  AFTER INSERT ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_collection();
