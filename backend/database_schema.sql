-- Create Users table (extends Supabase Auth)
create table public.users (
  id uuid references auth.users not null primary key,
  email text not null unique,
  name text,
  picture text,
  role text default 'Student',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on users table
alter table public.users enable row level security;

-- Users can read their own profile
create policy "Users can view their own profile"
  on public.users for select
  using ( auth.uid() = id );

-- Users can insert/update their own profile
create policy "Users can update their own profile"
  on public.users for update
  using ( auth.uid() = id );

create policy "Users can insert their own profile"
  on public.users for insert
  with check ( auth.uid() = id );

-- Create Notes table
create table public.notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  video_url text not null,
  title text not null,
  content jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on notes
alter table public.notes enable row level security;

-- Users can only see and manage their own notes
create policy "Users can view their own notes"
  on public.notes for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own notes"
  on public.notes for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own notes"
  on public.notes for delete
  using ( auth.uid() = user_id );

-- Function to handle new user signups and mirror them to public.users table
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, picture)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
