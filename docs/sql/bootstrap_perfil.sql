-- Primeiro usuário staff (Qualidade/Compliance).
-- 1. Crie o usuário em Authentication → Users (e-mail + senha).
-- 2. Copie o UUID do usuário e rode no SQL Editor (substitui os placeholders):

-- insert into public.perfis (id, role)
-- values ('<uuid-do-usuario-auth>', 'staff');

-- Correspondente (vê só o próprio):
-- insert into public.perfis (id, role, correspondente_id)
-- values ('<uuid-do-usuario-auth>', 'correspondente', '<uuid-em-correspondentes>');
