const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const uuid = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const fsSync = require('fs');

// Set ffmpeg path
ffmpeg.setFfmpegPath('C:\\ffmpeg\\ffmpeg-2025-01-22-git-e20ee9f9ae-full_build\\ffmpeg-2025-01-22-git-e20ee9f9ae-full_build\\bin\\ffmpeg.exe');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// Configure multer for video upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const videoFolder = path.join(__dirname, 'videos', uuid.v4());
        fsSync.mkdirSync(videoFolder, { recursive: true });
        cb(null, videoFolder);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index1.html'));
});

// Scan videos directory
app.get('/scan', async (req, res) => {
    try {
        const videosDir = path.join(__dirname, 'videos');
        const videos = [];

        async function scanDir(dir) {
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    const hlsPath = path.join(fullPath, 'hls', 'playlist.m3u8');
                    try {
                        await fs.access(hlsPath);
                        // If we can access the playlist, add it to videos
                        const relativePath = path.relative(videosDir, fullPath);
                        const stats = await fs.stat(fullPath);
                        
                        // Get the original video file name
                        const dirContents = await fs.readdir(fullPath);
                        const videoFile = dirContents.find(file => 
                            file.endsWith('.mp4') && !file.includes('playlist'));
                        
                        videos.push({
                            path: relativePath,
                            name: videoFile || item.name,
                            added: stats.mtime
                        });
                    } catch (e) {
                        // No playlist.m3u8 found, continue scanning
                        await scanDir(fullPath).catch(() => {}); // Ignore errors in subdirectories
                    }
                }
            }
        }

        await scanDir(videosDir);
        res.json(videos);
    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({ error: 'Failed to scan videos directory' });
    }
});

// Upload video
app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No video uploaded.');
    }

    const videoPath = req.file.path;
    const outputFolder = path.join(path.dirname(videoPath), 'hls');
    fsSync.mkdirSync(outputFolder, { recursive: true });
    const hlsPlaylistPath = path.join(outputFolder, 'playlist.m3u8');

    // Convert video to HLS
    ffmpeg(videoPath)
        .outputOptions([
            '-profile:v baseline',
            '-level 3.0',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls'
        ])
        .output(hlsPlaylistPath)
        .on('end', () => {
            console.log('Conversion finished');
            res.json({
                message: 'Video uploaded and converted to HLS.',
                videoUrl: `/videos/${path.basename(path.dirname(videoPath))}/hls/playlist.m3u8`
            });
        })
        .on('progress', (progress) => {
            console.log('Processing: ' + progress.percent + '% done');
        })
        .on('error', (err) => {
            console.error('FFMPEG Error:', err);
            res.status(500).send('Error converting video to HLS.');
        })
        .run();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    
    // Create videos directory if it doesn't exist
    const videosDir = path.join(__dirname, 'videos');
    fsSync.mkdirSync(videosDir, { recursive: true });
});

// Clean up function for handling server shutdown
process.on('SIGINT', () => {
    console.log('Server shutting down...');
    process.exit();
});