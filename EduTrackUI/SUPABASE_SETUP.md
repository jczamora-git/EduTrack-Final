# Supabase Storage Setup Guide

This guide walks you through setting up Supabase Storage for the EduTrack messaging file attachments feature.

## Step 1: Create the Storage Bucket

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your EduTrack project
3. In the left sidebar, click **Storage**
4. Click **Create a new bucket**
5. Enter bucket name: `uploads`
6. **Toggle ON** "Make bucket public"
7. Click **Create bucket**

## Step 2: Configure RLS Policies

Supabase Storage uses RLS policies to control who can upload and download files. You'll set up two policies:

### Policy 1: Allow Users to Upload to Their Own Folder

1. In the Storage section, click the `uploads` bucket
2. Click the **Policies** tab
3. Click **New Policy** → **For full customization**
4. Configure as follows:
   ```
   Name: Allow users to upload to their own messages folder
   Target roles: authenticated
   Using expression: (bucket_id = 'uploads'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
   With check: (bucket_id = 'uploads'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
   ```
   - Click **Review** → **Save policy**

### Policy 2: Allow Public Read Access

1. Click **New Policy** → **For full customization**
2. Configure as follows:
   ```
   Name: Allow public read access
   Target roles: anon, authenticated
   Using expression: (bucket_id = 'uploads'::text)
   With check: false
   ```
   - This allows anyone to download/view files from the public bucket
   - Click **Review** → **Save policy**

## Step 3: Configure Environment Variables

1. In your Supabase project, go to **Settings** → **API**
2. Copy your **Project URL** and **Anon Key**
3. In your EduTrackUI folder, create/update `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with your actual project URL and anon key.

## Step 4: Test the Setup

1. Start the dev server: `npm run dev`
2. Open a conversation in the messaging UI
3. Try uploading a file
4. The file should upload to: `uploads/messages/{user_id}/{filename}`
5. Once uploaded, the image/file should display in the message

## Troubleshooting

### Error: "Bucket not found"
- Ensure the bucket name is exactly `uploads` (lowercase)
- Verify the bucket is set to "Public"

### Error: "Permission denied"
- Check that RLS policies are configured correctly
- Ensure your auth user ID is numeric (e.g., user ID: 52)
- RLS policies must match the path structure: `messages/{user_id}/*`

### Files not displaying
- Verify the file URL is correct in the browser console
- Check that the bucket is public (not private)
- Ensure the file was actually uploaded to Supabase

### Upload fails silently
- Check browser console for errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly
- File size limit is 10MB

## Reference: RLS Policy Variables

- `auth.uid()` - Returns the current authenticated user's ID (numeric)
- `bucket_id` - The storage bucket name
- `storage.foldername(name)` - Extracts folder path from file name
  - Path `messages/52/file.jpg` → `['messages', '52', 'file.jpg']`
  - `[1]` gets the second element (the user ID)

## File Structure

Files are stored with this structure:
```
uploads/
  messages/
    {user_id}/
      {sanitized_filename}_{timestamp}_{random}.{ext}
```

Example:
- Path: `uploads/messages/52/mca-logo_1764355944800_ka572y.jpg`
- Public URL: `https://vjycvcuvclgekiidlcnc.supabase.co/storage/v1/object/public/uploads/messages/52/mca-logo_1764355944800_ka572y.jpg`
