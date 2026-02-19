import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { fileName, data, userId } = req.body;

    if (!fileName || !data || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert timetable data into Supabase
    const { data: insertedData, error } = await supabase
      .from('timetables')
      .insert([
        {
          user_id: userId,
          file_name: fileName,
          data: data,
          metadata: {
            uploadedAt: new Date().toISOString(),
            rowCount: data.length,
          },
        },
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({
      success: true,
      data: insertedData,
      message: 'Timetable uploaded successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
}
