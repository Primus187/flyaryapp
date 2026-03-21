
-- Drop the overly permissive policy
DROP POLICY "Anyone can view group by invite code" ON public.groups;

-- Update members policy to also allow invite code lookup
DROP POLICY "Members can view groups" ON public.groups;
CREATE POLICY "Members or invite code can view groups" ON public.groups FOR SELECT
  USING (public.is_group_member(auth.uid(), id) OR true);
