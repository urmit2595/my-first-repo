import os
from pathlib import Path
from dotenv import load_dotenv
from typing import Dict, Any, List
import json

# Load environment variables
load_dotenv()

class Config:
    # API Settings
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("Please set OPENAI_API_KEY in .env file")
    
    # Image Generation Settings - Optimized for motion
    IMAGE_MODEL = "dall-e-3"
    IMAGE_SIZE = "1792x1024"  # 16:9 for video
    IMAGE_QUALITY = "hd"
    
    # Motion and Style Settings
    ENABLE_MOTION_LAYERS = os.getenv("ENABLE_MOTION_LAYERS", "true").lower() == "true"
    STYLE_REFERENCE_URL = os.getenv("STYLE_REFERENCE_URL", "")
    
    # Enhanced prompt keywords for motion
    MOTION_KEYWORDS = {
        "zoom_in": "composed for zoom-in animation, important elements in center, clear focal point",
        "rotate_reveal": "360-degree product showcase composition, clean background for rotation",
        "map_expansion": "top-down view with clear geographic elements, suitable for animated expansion",
        "fly_through": "depth-layered composition for parallax fly-through effect",
        "money_flow": "dynamic arrangement with space for particle effects",
        "hero_reveal": "dramatic lighting, silhouette-to-reveal composition",
        "playful_bounce": "whimsical arrangement with bouncy elements",
        "industrial_sweep": "wide establishing shot with detailed production elements",
        "epic_assembly": "convergence composition with multiple focal points"
    }
    
    # Style Consistency Settings
    STYLE_REFERENCE_MODE = True
    CONSISTENCY_KEYWORDS = [
        "maintain exact same art style",
        "keep consistent character designs", 
        "preserve color palette exactly",
        "match illustration technique",
        "same line weight and shading style",
        "consistent miniaturized proportions"
    ]
    
    # Layer Export Settings
    LAYER_EXPORT_FORMATS = ["png", "psd"]  # Future: PSD for After Effects
    SEPARATE_LAYERS = ["background", "midground", "foreground", "overlay"]
    
    # Paths
    BASE_DIR = Path(__file__).parent
    DATA_DIR = BASE_DIR / "data"
    OUTPUT_DIR = BASE_DIR / "output"
    IMAGES_DIR = OUTPUT_DIR / "images"
    LAYERS_DIR = OUTPUT_DIR / "layers"
    PROMPTS_DIR = OUTPUT_DIR / "prompts"
    MOTION_GUIDES_DIR = OUTPUT_DIR / "motion_guides"
    LOGS_DIR = OUTPUT_DIR / "logs"
    
    # Create directories
    for dir_path in [OUTPUT_DIR, IMAGES_DIR, LAYERS_DIR, PROMPTS_DIR, 
                     MOTION_GUIDES_DIR, LOGS_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)
    
    # Creative Variation Settings
    VARIATION_STYLES = {
        "dynamic": "more motion blur and speed lines",
        "cinematic": "dramatic lighting and depth of field",
        "playful": "extra colorful with bouncy elements",
        "technical": "more UI elements and data visualization"
    }
    
    # Retry Settings
    MAX_RETRIES = 3
    RETRY_DELAY = 2
    
    @classmethod
    def load_timeline_data(cls) -> Dict[str, Any]:
        """Load the enhanced timeline with motion data"""
        timeline_path = cls.DATA_DIR / "emotorad_timeline.json"
        with open(timeline_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @classmethod
    def load_motion_styles(cls) -> Dict[str, Any]:
        """Load motion style definitions"""
        motion_path = cls.DATA_DIR / "motion_styles.json"
        if motion_path.exists():
            with open(motion_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    @classmethod
    def load_founder_data(cls) -> Dict[str, Any]:
        path = cls.DATA_DIR / "founder_descriptions.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    @classmethod
    def get_scene_paths(cls, scene_number: int, version: int = 1) -> Dict[str, Path]:
        """Get all paths for a scene (main image + layers)"""
        paths = {
            "main": cls.IMAGES_DIR / f"scene_{scene_number:02d}_v{version}.png",
            "prompt": cls.PROMPTS_DIR / f"scene_{scene_number:02d}_prompt.txt",
            "motion_guide": cls.MOTION_GUIDES_DIR / f"scene_{scene_number:02d}_motion.json"
        }
        
        # Add layer paths if enabled
        if cls.ENABLE_MOTION_LAYERS:
            for layer in cls.SEPARATE_LAYERS:
                paths[f"layer_{layer}"] = cls.LAYERS_DIR / f"scene_{scene_number:02d}_{layer}.png"
        
        return paths

# Initialize and test
config = Config()
print(f"✅ Enhanced configuration loaded")
print(f"🎬 Motion layers: {'Enabled' if config.ENABLE_MOTION_LAYERS else 'Disabled'}")
print(f"📁 Output directory: {config.OUTPUT_DIR}")
