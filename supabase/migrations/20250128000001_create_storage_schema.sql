-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create folders table for nested folder structure
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    path TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN parent_id IS NULL THEN name
            ELSE name -- Will be updated with a trigger to include full path
        END
    ) STORED,
    UNIQUE(user_id, parent_id, name)
);

-- Create files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT NOT NULL,
    folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    s3_key TEXT NOT NULL,
    s3_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, folder_id, name)
);

-- Create indexes for better performance
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);

-- Function to update folder path recursively
CREATE OR REPLACE FUNCTION update_folder_path()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the path for the current folder and all its descendants
    WITH RECURSIVE folder_hierarchy AS (
        -- Base case: start with the updated folder
        SELECT id, name, parent_id, 
               CASE 
                   WHEN parent_id IS NULL THEN name::TEXT
                   ELSE (
                       SELECT string_agg(f.name, '/' ORDER BY level DESC)
                       FROM (
                           WITH RECURSIVE parent_path AS (
                               SELECT id, name, parent_id, 1 as level
                               FROM folders 
                               WHERE id = NEW.parent_id
                               
                               UNION ALL
                               
                               SELECT f.id, f.name, f.parent_id, pp.level + 1
                               FROM folders f
                               JOIN parent_path pp ON f.id = pp.parent_id
                           )
                           SELECT name FROM parent_path ORDER BY level DESC
                       ) f
                   ) || '/' || name
               END as new_path
        FROM folders 
        WHERE id = NEW.id
        
        UNION ALL
        
        -- Recursive case: get all descendants
        SELECT f.id, f.name, f.parent_id,
               fh.new_path || '/' || f.name
        FROM folders f
        JOIN folder_hierarchy fh ON f.parent_id = fh.id
    )
    UPDATE folders 
    SET path = folder_hierarchy.new_path,
        updated_at = NOW()
    FROM folder_hierarchy 
    WHERE folders.id = folder_hierarchy.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for path updates
CREATE TRIGGER trigger_update_folder_path
    AFTER INSERT OR UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_folder_path();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Folders policies
CREATE POLICY "Users can view their own folders"
    ON folders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders"
    ON folders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
    ON folders FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
    ON folders FOR DELETE
    USING (auth.uid() = user_id);

-- Files policies
CREATE POLICY "Users can view their own files"
    ON files FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
    ON files FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files"
    ON files FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
    ON files FOR DELETE
    USING (auth.uid() = user_id);