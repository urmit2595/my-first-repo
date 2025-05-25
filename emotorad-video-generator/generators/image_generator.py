import openai
from pathlib import Path
import requests
import time
import json
from datetime import datetime
from typing import Optional, Dict, Tuple, List
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.panel import Panel
from rich.table import Table

from config import Config
from prompts.motion_templates import MotionPromptTemplates

console = Console()

class MotionImageGenerator:
    def __init__(self):
        self.client = openai.OpenAI(api_key=Config.OPENAI_API_KEY)
        self.generated_images = {}
        self.style_reference = None
        
    def generate_motion_optimized_image(
        self,
        prompt: str,
        scene_number: int,
        scene_data: Dict,
        save_prompt: bool = True,
        variation_type: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[Path], Optional[Dict]]:
        """
        Generate an image optimized for motion with metadata
        Returns: (image_url, local_path, motion_guide)
        """
        # Save enhanced prompt
        if save_prompt:
            paths = Config.get_scene_paths(scene_number)
            with open(paths["prompt"], 'w', encoding='utf-8') as f:
                f.write(f"Scene {scene_number} Motion-Optimized Prompt:\n\n")
                f.write(f"Variation Type: {variation_type or 'main'}\n\n")
                f.write(prompt)
            
            # Save motion guide
            motion_guide = MotionPromptTemplates.create_motion_guide(scene_data)
            with open(paths["motion_guide"], 'w') as f:
                json.dump(motion_guide, f, indent=2)
        
        # Generate with progress display
        try:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                console=console
            ) as progress:
                task = progress.add_task(
                    f"🎨 Generating motion-optimized scene {scene_number}...", 
                    total=None
                )
                
                response = self.client.images.generate(
                    model=Config.IMAGE_MODEL,
                    prompt=prompt,
                    size=Config.IMAGE_SIZE,
                    quality=Config.IMAGE_QUALITY,
                    n=1
                )
                
                image_url = response.data[0].url
                revised_prompt = response.data[0].revised_prompt
                
                progress.update(task, description="📥 Downloading high-res image...")
                
                # Download image
                paths = Config.get_scene_paths(scene_number)
                local_path = self._download_image(image_url, paths["main"])
                
                # Store for reference
                self.generated_images[scene_number] = {
                    "url": image_url,
                    "path": local_path,
                    "prompt": prompt,
                    "revised_prompt": revised_prompt,
                    "motion_guide": motion_guide,
                    "variation": variation_type
                }
                
                # Display success with style
                success_panel = Panel(
                    f"✅ Scene {scene_number}: {scene_data['title']}\n"
                    f"📁 Image: {local_path.name}\n"
                    f"🎬 Motion: {scene_data.get('motion_direction', 'static')}",
                    title="[green]Generation Complete[/green]",
                    border_style="green"
                )
                console.print(success_panel)
                
                # Set as style reference if first scene
                if scene_number == 1 and not self.style_reference:
                    self.style_reference = revised_prompt
                    console.print("🎯 [yellow]Set as style reference for consistency[/yellow]")
                
                return image_url, local_path, motion_guide
                
        except Exception as e:
            console.print(f"❌ [red]Error generating scene {scene_number}: {str(e)}[/red]")
            return None, None, None
    
    def _download_image(self, url: str, save_path: Path) -> Optional[Path]:
        """Download and save image with error handling"""
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            with open(save_path, 'wb') as f:
                f.write(response.content)
            
            return save_path
            
        except Exception as e:
            console.print(f"❌ [red]Download error: {str(e)}[/red]")
            return None
    
    def generate_creative_variations(
        self,
        scene_number: int,
        base_prompt: str,
        scene_data: Dict,
        num_variations: int = 3
    ) -> List[Dict]:
        """Generate creative variations of a scene"""
        variations = []
        variation_types = list(Config.VARIATION_STYLES.keys())[:num_variations]
        
        console.print(f"\n🎨 Generating {num_variations} creative variations for scene {scene_number}")
        
        for i, var_type in enumerate(variation_types, 1):
            console.print(f"\n  Variation {i}/{num_variations}: [cyan]{var_type}[/cyan]")
            
            # Modify prompt for variation
            var_prompt = base_prompt + f"\n\nCreative variation: {Config.VARIATION_STYLES[var_type]}"
            
            url, path, guide = self.generate_motion_optimized_image(
                var_prompt, 
                scene_number,
                scene_data,
                save_prompt=False,
                variation_type=var_type
            )
            
            if path:
                # Rename with variation number
                new_path = Config.IMAGES_DIR / f"scene_{scene_number:02d}_v{i+1}_{var_type}.png"
                path.rename(new_path)
                
                variations.append({
                    "variation": i,
                    "type": var_type,
                    "path": new_path,
                    "url": url
                })
        
        return variations
    
    def batch_generate_with_motion(
        self,
        timeline_data: Dict,
        prompts: Dict[int, str],
        generate_variations: bool = False
    ) -> Dict[int, Dict]:
        """Generate all scenes with motion optimization"""
        results = {}
        brand = timeline_data["brand"]
        scenes = timeline_data["scenes"]
        
        # Display generation plan
        self._display_generation_plan(scenes)
        
        for scene in scenes:
            scene_num = scene["scene_number"]
            if scene_num not in prompts:
                continue
            
            console.print(f"\n{'='*60}")
            console.print(f"🎬 [bold]Scene {scene_num}: {scene['title']}[/bold]")
            console.print(f"{'='*60}")
            
            # Generate main image
            success = False
            for attempt in range(Config.MAX_RETRIES):
                url, path, guide = self.generate_motion_optimized_image(
                    prompts[scene_num],
                    scene_num,
                    scene
                )
                
                if url and path:
                    results[scene_num] = {
                        "main": {
                            "url": url,
                            "path": str(path),
                            "motion_guide": guide
                        },
                        "variations": []
                    }
                    success = True
                    break
                else:
                    if attempt < Config.MAX_RETRIES - 1:
                        console.print(f"⚠️  Retry {attempt + 1}/{Config.MAX_RETRIES}")
                        time.sleep(Config.RETRY_DELAY)
            
            if not success:
                console.print(f"❌ Failed to generate scene {scene_num}")
                continue
            
            # Generate variations if requested
            if generate_variations and success:
                variations = self.generate_creative_variations(
                    scene_num,
                    prompts[scene_num],
                    scene,
                    num_variations=2
                )
                results[scene_num]["variations"] = variations
        
        # Save complete generation log
        self._save_generation_log(results, timeline_data)
        
        return results
    
    def _display_generation_plan(self, scenes: List[Dict]):
        """Display visual generation plan"""
        table = Table(
            title="🎬 Motion-Optimized Generation Plan",
            show_header=True,
            header_style="bold magenta"
        )
        
        table.add_column("Scene", style="cyan", width=6)
        table.add_column("Title", style="green", width=25)
        table.add_column("Motion", style="yellow", width=20)
        table.add_column("Camera", style="blue", width=20)
        
        for scene in scenes:
            table.add_row(
                str(scene["scene_number"]),
                scene["title"],
                scene.get("motion_direction", "static"),
                scene.get("camera_movement", {}).get("type", "static")
            )
        
        console.print(table)
        console.print()
    
    def _save_generation_log(self, results: Dict, timeline_data: Dict):
        """Save detailed generation log with motion data"""
        log_data = {
            "generation_timestamp": datetime.now().isoformat(),
            "brand": timeline_data["brand"]["name"],
            "total_scenes": len(results),
            "scenes": results,
            "style_reference": self.style_reference,
            "config": {
                "model": Config.IMAGE_MODEL,
                "size": Config.IMAGE_SIZE,
                "quality": Config.IMAGE_QUALITY,
                "motion_layers": Config.ENABLE_MOTION_LAYERS
            }
        }
        
        log_path = Config.LOGS_DIR / f"motion_generation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)
        
        console.print(f"\n📊 Complete log saved to: {log_path}")

# Test
if __name__ == "__main__":
    generator = MotionImageGenerator()
    console.print("✅ Motion image generator ready")
