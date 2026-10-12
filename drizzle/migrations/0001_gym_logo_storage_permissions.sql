CREATE POLICY "staff read gym logo setting" ON public.app_settings FOR SELECT TO authenticated USING (key = 'gym_logo');
CREATE POLICY "signed in read gym branding" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'gym-branding');
CREATE POLICY "admins upload gym branding" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'gym-branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete gym branding" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'gym-branding' AND public.has_role(auth.uid(), 'admin'));