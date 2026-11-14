# Video Optimization Guide

## MP4 File Optimization

To ensure optimal performance for users with slow internet connections, follow these guidelines when preparing MP4 files:

### Recommended Settings

1. **Resolution**: 720p (1280x720) or lower for web
2. **Frame Rate**: 24-30 fps
3. **Codec**: H.264
4. **Bitrate**: 800kbps - 1.5Mbps for 720p
5. **Audio**: AAC, 128kbps or lower (or no audio for demo videos)
6. **Duration**: Keep under 30 seconds for demo videos

### FFmpeg Commands

```bash
# Basic optimization
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -movflags +faststart output.mp4

# For smaller file sizes (higher compression)
ffmpeg -i input.mp4 -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 96k -movflags +faststart output.mp4

# For web optimization (recommended)
ffmpeg -i input.mp4 -c:v libx264 -crf 25 -preset medium -c:a aac -b:a 128k -movflags +faststart -vf "scale=1280:720:force_original_aspect_ratio=decrease" output.mp4

# For demo videos without audio (smallest file size)
ffmpeg -i input.mp4 -c:v libx264 -crf 25 -preset medium -an -movflags +faststart -vf "scale=1280:720:force_original_aspect_ratio=decrease" output.mp4
```

### File Size Targets

- **search-a-topic.mp4**: < 2MB
- **real-outcomes.mp4**: < 2MB  
- **overthinking-it.mp4**: < 2MB

### Current Implementation

The OptimizedVideo component is a simple replacement for GIFs with the following features:

1. **Autoplay**: Videos start playing automatically when loaded
2. **Loop**: Videos repeat continuously like GIFs
3. **Muted**: Required for autoplay to work in browsers
4. **Plays Inline**: Prevents fullscreen on mobile devices
5. **Responsive**: Scales with container width up to maxWidth

### Performance Benefits

- **Smaller File Size**: MP4 files are typically 10-50% smaller than equivalent GIFs
- **Better Quality**: Higher quality at smaller file sizes
- **Better Compression**: H.264 codec is more efficient than GIF format
- **Caching**: 1-year cache headers for MP4 files in Next.js config

### Browser Support

- Modern browsers support MP4 with H.264 codec
- Fallback text for browsers that don't support video
- Mobile-friendly with playsInline attribute 