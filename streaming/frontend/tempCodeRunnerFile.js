const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const uuid = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath('C:\\\\ffmpeg\\\\ffmpeg-2025-01-22-git-e20ee9f9ae-full_build\\\\ffmpeg-2025-01-22-git-e20ee9f9ae-full_build\\\\bin\\\\ffmpeg.exe');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use('/videos', express.static(path.join(__dirname, 'videos')));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const videoFolder = path.join(__dirname, 'videos', uuid.v4());
        fs.mkdirSync(videoFolder, { recursive: true });
        cb(null, videoFolder);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No video uploaded.');
    }

    const videoPath = req.file.path;
    const outputFolder = path.join(req.file.destination, 'hls');
    fs.mkdirSync(outputFolder, { recursive: true });
    const hlsPlaylistPath = path.join(outputFolder, 'playlist.m3u8');

    ffmpeg(videoPath)
        .outputOptions([
            '-profile:v baseline',
            '-level 3.0',
            '-s 640x360',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls'
        ])
        .output(hlsPlaylistPath)
        .on('end', () => {
            res.json({ message: 'Video uploaded and converted to HLS.', videoUrl: `/videos/${path.basename(req.file.destination)}/hls/playlist.m3u8` });
        })
        .on('error', (err) => {
            console.error('FFMPEG Error:', err); // Log the detailed error
            res.status(500).send('Error converting video to HLS.');
        })
        .run();
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
