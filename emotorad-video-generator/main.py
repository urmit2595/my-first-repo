#!/usr/bin/env python3
"""
Emotorad Motion Video Image Generator
Creates motion-optimized images for dynamic video production
"""

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Prompt, Confirm, IntPrompt
from rich.layout import Layout
from rich.text import Text
from pathlib import Path
import json
from datetime import datetime
from typing import Dict

from config import Config
from prompts.templates import PromptTemplates
from prompts.motion_templates import MotionPromptTemplates
from generators.image_generator import MotionImageGenerator

# Initialize
app = typer.Typer()
console = Console()

def display_motion_welcome():
    """Display enhanced welcome with motion focus"""
    layout = Layout()
    
    welcome_text = Text()
    welcome_text.append("🎬 ", style="bold red")
    welcome_text.append("Emotorad Motion Video Generator\n\n", style="bold cyan")
    welcome_text.append("Features:\n", style="bold yellow")
    welcome_text.append("✨ Motion-optimized compositions\n", style="green")
    welcome_text.append("🎯 Consistent miniaturized style\n", style="green")
    welcome_text.append("🎨 Creative variations per scene\n", style="green")
    welcome_text.append("📹 Export-ready for video editing\n", style="green")
    welcome_text.append("🚀 YouTube-style dynamic movement\n", style="green")
    
    panel = Panel(
        welcome_text,
        title="[bold blue]Welcome to Motion Generation[/bold blue]",
        border_style="blue",
        padding=(1, 2)
    )
    
    console.print(panel)

def display_motion_timeline(timeline_data):
    """Display timeline with motion details"""
    table = Table(
        title="🎬 Emotorad Journey - Motion Storyboard",
        show_header=True,
        header_style="bold magenta",
        title_style="bold cyan"
    )
    
    table.add_column("#", style="cyan", width=3)
    table.add_column("Year", style="green", width=8)
    table.add_column("Scene", style="yellow", width=25)
    table.add_column("Motion Style", style="blue", width=20)
    table.add_column("Camera", style="magenta", width=20)
    
    for scene in timeline_data["scenes"]:
        table.add_row(
            str(scene["scene_number"]),
            scene["year"],
            scene["title"],
            scene.get("motion_direction", "static"),
            scene.get("camera_movement", {}).get("type", "static")
        )
    
    console.print(table)

def build_motion_prompts(timeline_data, founder_data):
    """Build motion-optimized prompts for all scenes"""
    prompts = {}
    brand = timeline_data["brand"]
    
    console.print("\n🔨 Building motion-optimized prompts...")
    
    with console.status("[bold green]Creating prompts...") as status:
        for scene in timeline_data["scenes"]:
            is_first = scene["scene_number"] == 1
            
            # Use motion template
            prompt = MotionPromptTemplates.create_motion_scene_prompt(
                scene=scene,
                brand=brand,
                founder_data=founder_data,
                is_first_scene=is_first
            )
            
            prompts[scene["scene_number"]] = prompt
            status.update(f"Created prompt for scene {scene['scene_number']}")
    
    console.print("✅ All motion prompts ready!")
    return prompts

@app.command()
def generate(
    single_scene: int = typer.Option(None, "--scene", "-s", help="Generate single scene"),
    variations: bool = typer.Option(False, "--variations", "-v", help="Generate creative variations"),
    num_variations: int = typer.Option(2, "--num-variations", "-n", help="Number of variations"),
    skip_confirm: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation"),
    motion_only: bool = typer.Option(False, "--motion-only", "-m", help="Generate motion guides only")
):
    """Generate motion-optimized images for Emotorad video"""
    
    display_motion_welcome()
    
    # Load data
    console.print("\n📁 Loading timeline and motion data...")
    timeline_data = Config.load_timeline_data()
    founder_data = Config.load_founder_data()
    motion_styles = Config.load_motion_styles()
    
    # Display motion timeline
    display_motion_timeline(timeline_data)
    
    # Show transition plan
    if "transitions" in motion_styles:
        console.print("\n🎞️ [bold]Planned Transitions:[/bold]")
        for transition, style in motion_styles["transitions"].items():
            console.print(f"  {transition}: [cyan]{style}[/cyan]")
    
    # Motion guides only mode
    if motion_only:
        console.print("\n📝 Generating motion guides only...")
        for scene in timeline_data["scenes"]:
            guide = MotionPromptTemplates.create_motion_guide(scene)
            path = Config.MOTION_GUIDES_DIR / f"scene_{scene['scene_number']:02d}_motion.json"
            with open(path, 'w') as f:
                json.dump(guide, f, indent=2)
        console.print("✅ Motion guides created!")
        return
    
    # Confirm generation
    if not skip_confirm:
        total_images = len(timeline_data["scenes"])
        if variations:
            total_images *= (num_variations + 1)
        
        generation_info = Panel(
            f"Scenes to generate: {len(timeline_data['scenes'])}\n"
            f"Variations per scene: {num_variations if variations else 0}\n"
            f"Total images: {total_images}\n"
            f"Estimated time: {total_images * 30} seconds",
            title="Generation Plan",
            border_style="yellow"
        )
        console.print(generation_info)
        
        if not Confirm.ask("\n🎯 Ready to generate motion-optimized images?"):
            console.print("👋 Generation cancelled")
            return
    
    # Build prompts
    all_prompts = build_motion_prompts(timeline_data, founder_data)
    
    # Filter for single scene
    if single_scene:
        if single_scene not in all_prompts:
            console.print(f"❌ Scene {single_scene} not found!")
            return
        
        scenes_to_generate = [s for s in timeline_data["scenes"] 
                              if s["scene_number"] == single_scene]
        prompts_to_generate = {single_scene: all_prompts[single_scene]}
    else:
        scenes_to_generate = timeline_data["scenes"]
        prompts_to_generate = all_prompts
    
    # Initialize generator
    generator = MotionImageGenerator()
    
    # Generate with motion optimization
    console.print(f"\n🚀 Starting motion-optimized generation...")
    results = generator.batch_generate_with_motion(
        timeline_data,
        prompts_to_generate,
        generate_variations=variations
    )
    
    # Display results summary
    display_generation_summary(results)
    
    # Show next steps
    display_video_creation_guide()

def display_generation_summary(results: Dict):
    """Display beautiful generation summary"""
    table = Table(
        title="✅ Generation Summary",
        show_header=True,
        header_style="bold green"
    )
    
    table.add_column("Scene", style="cyan")
    table.add_column("Main Image", style="green")
    table.add_column("Variations", style="yellow")
    table.add_column("Motion Guide", style="blue")
    
    for scene_num, data in results.items():
        main_path = Path(data["main"]["path"]).name
        var_count = len(data.get("variations", []))
        has_guide = "✓" if data["main"].get("motion_guide") else "✗"
        
        table.add_row(
            str(scene_num),
            main_path,
            f"{var_count} variations" if var_count > 0 else "None",
            has_guide
        )
    
    console.print("\n")
    console.print(table)

def display_video_creation_guide():
    """Display comprehensive video creation guide"""
    guide_text = """
    🎬 Video Creation Guide (YouTube Style Motion)
    
    1. Import to Video Editor:
       - Load images sequentially (scene_01 to scene_09)
       - Each scene: 5-7 seconds duration
       - Check motion_guides/ for specific timing
    
    2. Apply Motion (Based on Reference Video):
       - Scene 1: Zoom in from wide to founders
       - Scene 2: 360° product rotation
       - Scene 3: Map expansion animation
       - Scene 4: Fly-through to Dubai
       - Scene 5: Money particle effects
       - Scene 6: Hero reveal with lighting
       - Scene 7: Playful bounce effects
       - Scene 8: Industrial crane shot
       - Scene 9: Multi-angle montage
    
    3. Transitions (High Energy):
       - Use whip pans between scenes
       - Match motion direction
       - 0.5-1 second duration
       - Add motion blur
    
    4. Text Overlays:
       - Use text from motion_guides/
       - Animate in with scene motion
       - Bold, readable fonts
       - Brand colors: #00D4FF, #FF6B35
    
    5. Effects & Polish:
       - Add particle overlays
       - Use parallax on layers
       - Subtle camera shake on energy scenes
       - Speed ramping on transitions
    
    6. Music & Sound:
       - Upbeat electronic/tech music
       - Sound effects for transitions
       - Whoosh sounds for camera moves
       - Impact sounds for text
    
    📁 Your Files:
       - Images: output/images/
       - Motion Guides: output/motion_guides/
       - Prompts: output/prompts/
       - Logs: output/logs/
    """
    
    console.print(Panel(
        guide_text,
        title="[bold cyan]Next Steps - Create Your Video[/bold cyan]",
        border_style="cyan",
        padding=(1, 2)
    ))

@app.command()
def preview():
    """Preview timeline and sample prompts"""
    display_motion_welcome()
    
    # Load data
    timeline_data = Config.load_timeline_data()
    founder_data = Config.load_founder_data()
    
    # Display timeline
    display_motion_timeline(timeline_data)
    
    # Show motion styles
    motion_styles = Config.load_motion_styles()
    if motion_styles:
        console.print("\n🎨 Motion Styles Available:")
        for style, details in motion_styles.items():
            if isinstance(details, dict):
                console.print(f"  {style}: {details.get('description', 'N/A')}")
    
    # Show sample prompt
    if Confirm.ask("\n👀 View sample motion-optimized prompt?"):
        prompts = build_motion_prompts(timeline_data, founder_data)
        
        scene_choice = IntPrompt.ask(
            "Which scene?",
            default=1,
            choices=[str(i) for i in range(1, 10)]
        )
        
        if scene_choice in prompts:
            console.print(f"\n📝 Motion Prompt for Scene {scene_choice}:")
            console.print(Panel(
                prompts[scene_choice],
                border_style="cyan",
                padding=(1, 2)
            ))

@app.command()
def package():
    """Create video editing package with all assets"""
    from utils.file_manager import MotionFileManager
    
    console.print("📦 Creating video editing package...")
    
    # Create package
    package_path = MotionFileManager.create_motion_video_package()
    
    # Also create image grid
    if Confirm.ask("\n🖼️  Create image grid preview?"):
        grid_path = MotionFileManager.create_image_grid()
        console.print(f"✅ Grid saved to: {grid_path}")

@app.command()
def clean():
    """Clean output directories"""
    if Confirm.ask("🗑️  Delete all generated content?"):
        folders = [
            Config.IMAGES_DIR,
            Config.LAYERS_DIR,
            Config.PROMPTS_DIR,
            Config.MOTION_GUIDES_DIR,
            Config.LOGS_DIR
        ]
        
        file_count = 0
        for folder in folders:
            for file in folder.glob("*"):
                if file.is_file():
                    file.unlink()
                    file_count += 1
        
        console.print(f"✅ Cleaned {file_count} files")

if __name__ == "__main__":
    app()
