from pathlib import Path
import shutil
import json
from datetime import datetime
from typing import Dict, List
from PIL import Image
from rich.console import Console

from config import Config

console = Console()

class MotionFileManager:
    @staticmethod
    def create_motion_video_package(package_name: str = None) -> Path:
        """Create comprehensive package for video editing"""
        if not package_name:
            package_name = f"emotorad_motion_package_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        package_dir = Config.OUTPUT_DIR / package_name
        package_dir.mkdir(exist_ok=True)
        
        # Create structured directories
        dirs = {
            "images": package_dir / "01_images",
            "variations": package_dir / "02_variations",
            "motion_guides": package_dir / "03_motion_guides",
            "text_overlays": package_dir / "04_text_overlays",
            "voiceover": package_dir / "05_voiceover_scripts",
            "after_effects": package_dir / "06_after_effects",
            "kling_export": package_dir / "07_kling_export",
            "reference": package_dir / "08_reference"
        }
        
        for dir_path in dirs.values():
            dir_path.mkdir(exist_ok=True)
        
        # Copy main images
        image_files = sorted(Config.IMAGES_DIR.glob("scene_*_v1.png"))
        for img in image_files:
            shutil.copy2(img, dirs["images"] / img.name)
        
        # Copy variations
        variation_files = Config.IMAGES_DIR.glob("scene_*_v[2-9]*.png")
        for var in variation_files:
            shutil.copy2(var, dirs["variations"] / var.name)
        
        # Copy motion guides
        motion_files = Config.MOTION_GUIDES_DIR.glob("*.json")
        for motion in motion_files:
            shutil.copy2(motion, dirs["motion_guides"] / motion.name)
        
        # Load timeline for text and scripts
        timeline_data = Config.load_timeline_data()
        
        # Create text overlay files with timing
        for scene in timeline_data["scenes"]:
            scene_num = scene["scene_number"]
            
            # Text overlay with animation notes
            text_file = dirs["text_overlays"] / f"scene_{scene_num:02d}_text.json"
            text_data = {
                "scene": scene_num,
                "main_text": scene["text_overlay"],
                "title": scene["title"],
                "year": scene["year"],
                "animation": {
                    "entrance": "slide_up_fade",
                    "entrance_duration": 0.5,
                    "hold_duration": 4,
                    "exit": "fade_out",
                    "exit_duration": 0.5
                },
                "position": {
                    "x": "center",
                    "y": "bottom_third",
                    "margin": 50
                },
                "style": {
                    "font": "Montserrat Bold",
                    "size": 48,
                    "color": "#FFFFFF",
                    "stroke": "#00D4FF",
                    "stroke_width": 2,
                    "shadow": True
                }
            }
            
            with open(text_file, 'w') as f:
                json.dump(text_data, f, indent=2)
        
        # Create voiceover scripts with timing marks
        MotionFileManager._create_voiceover_scripts(timeline_data, dirs["voiceover"])
        
        # Create After Effects guide
        MotionFileManager._create_ae_guide(dirs["after_effects"], timeline_data)
        
        # Create Kling-specific export
        MotionFileManager._create_kling_export(dirs["kling_export"], timeline_data)
        
        # Create master instruction file
        master_instructions = f"""
EMOTORAD MOTION VIDEO PACKAGE
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
========================================

DIRECTORY STRUCTURE:
- 01_images/: Main hero images for each scene
- 02_variations/: Alternative versions for creative options  
- 03_motion_guides/: JSON files with motion specifications
- 04_text_overlays/: Text with positioning and animation data
- 05_voiceover_scripts/: Scripts formatted for voice recording
- 06_after_effects/: AE-specific project guides
- 07_kling_export/: Kling AI-ready assets
- 08_reference/: Style guides and references

VIDEO SPECIFICATIONS:
- Total Duration: 45-60 seconds
- Scene Duration: 5-7 seconds each
- Aspect Ratio: 16:9 (1920x1080 or higher)
- Frame Rate: 30fps minimum
- Style: High-energy motion graphics

QUICK START:
1. Import all images from 01_images/ in sequence
2. Apply motion from 03_motion_guides/
3. Add text from 04_text_overlays/
4. Follow transition guide in motion_guides/
5. Add music and sound effects
6. Export in high quality

COLOR PALETTE:
- Primary: #00D4FF (Cyan)
- Secondary: #FF6B35 (Orange)  
- Accent: #4ECDC4 (Teal)
- Text: #FFFFFF (White)

MUSIC SUGGESTION:
- Genre: Electronic/Tech/Corporate
- BPM: 120-140
- Mood: Uplifting, Energetic, Inspiring
- Build: Start subtle, build to climax at MS Dhoni scene
"""
        
        with open(package_dir / "README.txt", 'w') as f:
            f.write(master_instructions)
        
        # Create project summary
        summary = {
            "package_name": package_name,
            "created_at": datetime.now().isoformat(),
            "total_scenes": len(timeline_data["scenes"]),
            "total_images": len(list(dirs["images"].glob("*.png"))),
            "has_variations": len(list(dirs["variations"].glob("*.png"))) > 0,
            "brand": timeline_data["brand"],
            "ready_for": ["After Effects", "Premiere Pro", "DaVinci Resolve", "Kling AI"]
        }
        
        with open(package_dir / "package_summary.json", 'w') as f:
            json.dump(summary, f, indent=2)
        
        console.print(f"\n✅ [green]Motion video package created![/green]")
        console.print(f"📦 Location: {package_dir}")
        console.print(f"📁 Total files: {sum(1 for d in dirs.values() for _ in d.glob('*'))}")
        
        return package_dir
    
    @staticmethod
    def _create_voiceover_scripts(timeline_data: Dict, voiceover_dir: Path):
        """Create formatted voiceover scripts"""
        # Individual scene scripts
        for scene in timeline_data["scenes"]:
            scene_num = scene["scene_number"]
            script_file = voiceover_dir / f"scene_{scene_num:02d}_voiceover.txt"
            
            script = f"""SCENE {scene_num}: {scene['title']}
Duration: 5-7 seconds
Tone: Energetic, Inspiring

SCRIPT:
{scene['year']}. {scene['title']}. {scene['description']}

TIMING NOTES:
- Start immediately as scene appears
- Emphasize key words: {', '.join(scene['key_elements'][:2])}
- Pause before transition to next scene
"""
            
            with open(script_file, 'w') as f:
                f.write(script)
        
        # Full narration script
        full_script = voiceover_dir / "full_narration_script.txt"
        with open(full_script, 'w') as f:
            f.write("EMOTORAD: THE JOURNEY OF INNOVATION\n")
            f.write("="*50 + "\n\n")
            f.write("Total Duration: 45-60 seconds\n")
            f.write("Voice: Confident, Inspiring, Tech-savvy\n\n")
            
            for scene in timeline_data["scenes"]:
                f.write(f"[{scene['year']}]\n")
                f.write(f"{scene['title']}. {scene['description']}\n")
                f.write(f"[Pause 0.5s]\n\n")
    
    @staticmethod
    def _create_ae_guide(ae_dir: Path, timeline_data: Dict):
        """Create After Effects specific guides"""
        ae_guide = """AFTER EFFECTS PROJECT SETUP
==========================

1. PROJECT SETTINGS:
   - Composition: 1920x1080, 30fps
   - Duration: 60 seconds
   - Color: sRGB

2. LAYER STRUCTURE PER SCENE:
   - BG: Background plate
   - MID: Main action layer
   - FG: Foreground elements
   - TEXT: Text overlays
   - FX: Particle effects

3. ESSENTIAL EFFECTS:
   - Motion Blur: ON for all moving layers
   - Camera: 3D camera for depth
   - Particles: CC Particle World
   - Glow: Sapphire or native

4. EXPRESSIONS TO USE:
   // Wiggle for energy
   wiggle(2, 10)
   
   // Bounce for text
   amp = .05;
   freq = 2.0;
   decay = 3.0;
   
5. TRANSITION PRESETS:
   - Whip Pan: Direction Blur + Position
   - Zoom Trans: Scale + Motion Blur
   - Tech Glitch: Displacement Map
"""
        with open(ae_dir / "after_effects_setup.txt", 'w') as f:
            f.write(ae_guide)
    
    @staticmethod
    def _create_kling_export(kling_dir: Path, timeline_data: Dict):
        """Create Kling AI specific export"""
        # Copy renamed images for Kling
        images = sorted(Config.IMAGES_DIR.glob("scene_*_v1.png"))
        for i, img in enumerate(images, 1):
            new_name = f"{i:02d}_emotorad_{img.stem}.png"
            shutil.copy2(img, kling_dir / new_name)
        
        # Kling instructions
        kling_guide = """KLING AI VIDEO GENERATION GUIDE
==============================

IMPORT SEQUENCE:
1. Upload all numbered images in order (01-09)
2. Set duration: 5 seconds per image
3. Total video: 45 seconds

MOTION SETTINGS PER SCENE:
1. Zoom In - Slow zoom to center
2. Rotate - 360 degree product spin
3. Pan Right - Map expansion effect
4. Fly Through - Depth parallax
5. Push In - Dramatic zoom
6. Hero Reveal - Lighting sweep
7. Bounce - Playful movement
8. Crane Up - Industrial sweep
9. Multi Cut - Quick transitions

TRANSITIONS:
- Use "Motion Blur" between all scenes
- Transition duration: 0.5 seconds
- Direction: Match scene motion

TEXT OVERLAY:
- Position: Lower third
- Font: Bold sans-serif
- Size: 10% of frame height
- Color: White with cyan outline

EXPORT SETTINGS:
- Resolution: 1920x1080
- Format: MP4 H.264
- Bitrate: 10 Mbps+
- Audio: AAC 320kbps
"""
        with open(kling_dir / "kling_instructions.txt", 'w') as f:
            f.write(kling_guide)
    
    @staticmethod
    def create_image_grid(output_name: str = "emotorad_storyboard.png") -> Path:
        """Create a storyboard grid of all scenes"""
        images = sorted(Config.IMAGES_DIR.glob("scene_*_v1.png"))
        
        if not images:
            console.print("❌ No images found for grid")
            return None
        
        # Load and resize images
        pil_images = []
        for img_path in images[:9]:
            img = Image.open(img_path)
            # Resize to consistent size
            img.thumbnail((600, 338), Image.Resampling.LANCZOS)  # 16:9 aspect
            pil_images.append(img)
        
        # Create 3x3 grid
        grid_width = 1800  # 600 * 3
        grid_height = 1014  # 338 * 3
        padding = 10
        
        grid = Image.new('RGB', 
                         (grid_width + padding * 4, grid_height + padding * 4), 
                         '#1a1a1a')
        
        # Place images with padding
        for idx, img in enumerate(pil_images):
            row = idx // 3
            col = idx % 3
            x = col * (600 + padding) + padding
            y = row * (338 + padding) + padding
            grid.paste(img, (x, y))
        
        # Save grid
        grid_path = Config.OUTPUT_DIR / output_name
        grid.save(grid_path, quality=95)
        
        console.print(f"✅ Storyboard grid saved to: {grid_path}")
        return grid_path

# Test
if __name__ == "__main__":
    fm = MotionFileManager()
    console.print("✅ Motion file manager ready")
